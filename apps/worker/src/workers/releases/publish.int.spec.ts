import { createHash } from 'node:crypto';
import { UnrecoverableError } from 'bullmq';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DB } from '#app/db.js';
import type { Storage } from '#lib/storage.js';
import { buildPreview, type Manifest } from './build.js';
import { publishRelease } from './publish.js';
import { TrackedStorage, resetReleaseTables, testPrefix } from './testing.js';

/** Publishing a preview against the test database and the real bucket. */
describe('publishRelease', () => {
	const db = DB.instance;
	const storage = new TrackedStorage();
	const prefix = testPrefix();
	const options = { prefix, baseUrl: 'https://releases.qotm.dev' };
	const actor = { id: 'admin-id', handle: 'mireille' };

	let n = 0;
	async function quote(status: 'CURATED' | 'DATASET_RELEASE') {
		return db.quote.create({
			data: {
				publicId: `q_rp${String(++n).padStart(4, '0')}`,
				text: `Published quote ${n}`,
				type: 'CANONICAL',
				status
			}
		});
	}

	/** A release with a built preview of two curated and one shipped quote. */
	async function preview() {
		await quote('CURATED');
		await quote('CURATED');
		await quote('DATASET_RELEASE');
		const release = await db.release.create({
			data: { version: 'v2026.10.1', schemaVersion: 1 }
		});
		await buildPreview(db, storage, { releaseId: release.id, actor }, options);
		return release.id;
	}

	/** Storage whose `nth` call of `method` fails, as a crash there would. */
	function crashingAt(method: 'put' | 'get', nth: number): Storage {
		let calls = 0;
		const crash = <T>(m: string, run: () => Promise<T>) =>
			m === method && ++calls === nth
				? Promise.reject(new Error('killed'))
				: run();
		return {
			put: (...args) => crash('put', () => storage.put(...args)),
			get: (key) => crash('get', () => storage.get(key)),
			putFile: (...args) => storage.putFile(...args),
			delete: (key) => storage.delete(key)
		};
	}

	const publishedOnce = async (releaseId: string) => {
		expect(
			await db.auditLog.count({ where: { action: 'release.published' } })
		).toBe(1);
		expect(
			await db.quoteEvent.count({ where: { toStatus: 'DATASET_RELEASE' } })
		).toBe(2);
		expect(
			(await db.release.findUniqueOrThrow({ where: { id: releaseId } })).state
		).toBe('PUBLISHED');
	};

	beforeEach(async () => {
		await resetReleaseTables(db);
	});
	afterAll(async () => {
		await storage.cleanUp();
		await resetReleaseTables(db);
		await db.disconnect();
	});

	it('freezes the release, ships its quotes, and writes the version’s files', async () => {
		const id = await preview();
		const before = await db.release.findUniqueOrThrow({ where: { id } });
		const result = await publishRelease(
			db,
			storage,
			{ releaseId: id, actor },
			options
		);
		expect(result.published).toBe(true);

		const row = await db.release.findUniqueOrThrow({ where: { id } });
		expect(row).toMatchObject({
			state: 'PUBLISHED',
			sha256: before.sha256,
			artifactKey: `${prefix}/v2026.10.1/qotm.sqlite`,
			manifestKey: `${prefix}/v2026.10.1/manifest.json`
		});
		expect(row.publishedAt).not.toBeNull();

		const file = await storage.fetch(row.artifactKey!);
		expect(createHash('sha256').update(file.bytes).digest('hex')).toBe(
			row.sha256
		);
		expect(file.cacheControl).toContain('immutable');
		const manifest = JSON.parse(
			(await storage.fetch(row.manifestKey!)).bytes.toString()
		) as Manifest;
		expect(manifest).toEqual({
			version: 'v2026.10.1',
			schemaVersion: 1,
			publishedAt: row.publishedAt!.toISOString(),
			url: 'https://releases.qotm.dev/v2026.10.1/qotm.sqlite',
			size: row.sizeBytes,
			sha256: row.sha256,
			changes: { eligible: 3, added: 3, corrected: 0, withdrawn: 0 }
		});

		expect(await db.quote.count({ where: { status: 'DATASET_RELEASE' } })).toBe(
			3
		);
		await publishedOnce(id);
		expect(
			await db.auditLog.findFirst({ where: { action: 'release.published' } })
		).toMatchObject({
			actorHandle: 'mireille',
			targetId: 'v2026.10.1',
			note: '+3 ~0 −0'
		});
	});

	it.each([
		['reading the preview', 'get', 1],
		['writing the file', 'put', 1],
		['writing the manifest, after the commit', 'put', 2]
	] as const)(
		'killed %s and retried: ends published exactly once',
		async (_, method, nth) => {
			const id = await preview();
			await expect(
				publishRelease(
					db,
					crashingAt(method, nth),
					{ releaseId: id, actor },
					options
				)
			).rejects.toThrow('killed');
			const firstPublishedAt = (
				await db.release.findUniqueOrThrow({ where: { id } })
			).publishedAt;

			const retry = await publishRelease(
				db,
				storage,
				{ releaseId: id, actor },
				options
			);
			await publishedOnce(id);
			const row = await db.release.findUniqueOrThrow({ where: { id } });
			// Only a crash after the commit leaves it published; the retry then
			// only finishes it.
			expect(Boolean(firstPublishedAt)).toBe(nth === 2);
			expect(retry.published).toBe(nth !== 2);
			if (firstPublishedAt) expect(row.publishedAt).toEqual(firstPublishedAt);
			expect(retry.manifest.publishedAt).toBe(row.publishedAt!.toISOString());
		}
	);

	it('publishes once when delivered twice at the same time', async () => {
		const id = await preview();
		const results = await Promise.all([
			publishRelease(db, storage, { releaseId: id, actor }, options),
			publishRelease(db, storage, { releaseId: id, actor }, options)
		]);
		expect(results.map((r) => r.published).sort()).toEqual([false, true]);
		await publishedOnce(id);
	});

	it('refuses a release without a built preview, for good', async () => {
		const draft = await db.release.create({
			data: { version: 'v2026.10.1', schemaVersion: 1 }
		});
		await expect(
			publishRelease(db, storage, { releaseId: draft.id, actor }, options)
		).rejects.toBeInstanceOf(UnrecoverableError);
		expect(
			(await db.release.findUniqueOrThrow({ where: { id: draft.id } })).state
		).toBe('DRAFT');
	});

	it('refuses a stale preview: a quote in it was withdrawn since', async () => {
		const id = await preview();
		const [shipped] = await db.releaseQuote.findMany({
			where: { releaseId: id }
		});
		await db.quote.update({
			where: { id: shipped!.quoteId },
			data: { status: 'WITHDRAWN' }
		});
		await expect(
			publishRelease(db, storage, { releaseId: id, actor }, options)
		).rejects.toThrow(/stale/);
		expect((await db.release.findUniqueOrThrow({ where: { id } })).state).toBe(
			'PREVIEW'
		);
	});
});
