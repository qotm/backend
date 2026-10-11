import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { UnrecoverableError } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DB } from '#app/db.js';
import { buildPreview, type Manifest } from './build.js';
import { TrackedStorage, resetReleaseTables, testPrefix } from './testing.js';

/** The preview build against the test database and the real bucket. */
describe('buildPreview', () => {
	const db = DB.instance;
	const storage = new TrackedStorage();
	const prefix = testPrefix();
	const options = { prefix, baseUrl: 'https://releases.qotm.dev' };
	// Not a real account: the audit row keeps the handle without the link.
	const actor = { id: 'admin-id', handle: 'mireille' };
	const dir = mkdtempSync(join(tmpdir(), 'qotm-int-'));

	let n = 0;
	async function quote(
		status: 'CURATED' | 'DATASET_RELEASE' | 'VERIFIED' | 'WITHDRAWN',
		text = `Release quote ${n + 1}`
	) {
		const author = await db.author.upsert({
			where: { slug: 'dijkstra' },
			update: {},
			create: { slug: 'dijkstra', name: 'Edsger W. Dijkstra' }
		});
		const topic = await db.topic.upsert({
			where: { slug: 'simplicity' },
			update: {},
			create: { slug: 'simplicity', name: 'simplicity' }
		});
		return db.quote.create({
			data: {
				publicId: `q_rb${String(++n).padStart(4, '0')}`,
				text,
				type: 'CANONICAL',
				status,
				authorId: author.id,
				topics: { create: { topicId: topic.id } }
			}
		});
	}
	const release = (version: string, state: 'DRAFT' | 'PUBLISHED' = 'DRAFT') =>
		db.release.create({
			data: {
				version,
				state,
				schemaVersion: 1,
				publishedAt: state === 'PUBLISHED' ? new Date() : null
			}
		});

	beforeAll(async () => {
		await resetReleaseTables(db);
	});
	beforeEach(async () => {
		await resetReleaseTables(db);
	});
	afterAll(async () => {
		await storage.cleanUp();
		await resetReleaseTables(db);
		rmSync(dir, { recursive: true, force: true });
		await db.disconnect();
	});

	it('compiles the eligible quotes, uploads the file and manifest, and records the preview', async () => {
		const curated = await quote(
			'CURATED',
			'Simplicity is prerequisite for reliability.'
		);
		await quote('DATASET_RELEASE');
		await quote('VERIFIED', 'Not curated yet.');
		await quote('WITHDRAWN', 'Withdrawn, never shipped.');
		const private_ = await db.quote.create({
			data: {
				publicId: 'q_rbpriv',
				text: 'Somebody private note.',
				type: 'PRIVATE',
				status: 'PRIVATE'
			}
		});
		const draft = await release('v2026.10.1');

		const result = await buildPreview(
			db,
			storage,
			{ releaseId: draft.id, actor },
			options
		);
		expect(result.changes).toEqual({
			eligible: 2,
			added: 2,
			corrected: 0,
			withdrawn: 0
		});

		const row = await db.release.findUniqueOrThrow({ where: { id: draft.id } });
		expect(row).toMatchObject({
			state: 'PREVIEW',
			eligibleCount: 2,
			addedCount: 2,
			schemaVersion: 1,
			sha256: result.sha256,
			sizeBytes: result.size,
			artifactKey: `${prefix}/previews/v2026.10.1/${result.sha256}/qotm.sqlite`,
			manifestKey: `${prefix}/previews/v2026.10.1/${result.sha256}/manifest.json`
		});
		expect(row.previewBuiltAt).not.toBeNull();

		// The uploaded file is the one recorded, and it opens with its quotes.
		const file = await storage.fetch(row.artifactKey!);
		expect(createHash('sha256').update(file.bytes).digest('hex')).toBe(
			row.sha256
		);
		expect(file.cacheControl).toContain('immutable');
		// Nothing excluded reaches the file: no account data, no quote
		// outside the eligible set.
		const content = file.bytes.toString('latin1');
		const users = await db.user.findMany({ select: { email: true } });
		expect(users.length).toBeGreaterThan(0);
		for (const { email } of users) expect(content).not.toContain(email);
		for (const text of ['Not curated yet', 'Withdrawn, never', private_.text]) {
			expect(content).not.toContain(text);
		}
		const local = join(dir, 'downloaded.sqlite');
		writeFileSync(local, file.bytes);
		const sqlite = new DatabaseSync(local, { readOnly: true });
		expect(
			sqlite
				.prepare(
					"SELECT q.id FROM quotes_fts f JOIN quotes q ON q.n = f.rowid WHERE quotes_fts MATCH 'reliability'"
				)
				.all()
				.map((r) => r.id)
		).toEqual([curated.publicId]);
		sqlite.close();

		const manifest = JSON.parse(
			(await storage.fetch(row.manifestKey!)).bytes.toString()
		) as Manifest;
		expect(manifest).toEqual({
			version: 'v2026.10.1',
			schemaVersion: 1,
			publishedAt: null,
			url: 'https://releases.qotm.dev/v2026.10.1/qotm.sqlite',
			size: row.sizeBytes,
			sha256: row.sha256,
			changes: { eligible: 2, added: 2, corrected: 0, withdrawn: 0 }
		});

		const shipped = await db.releaseQuote.findMany({
			where: { releaseId: draft.id },
			include: { quote: { select: { publicId: true } } }
		});
		expect(shipped.map((s) => s.quote.publicId).sort()).toEqual([
			'q_rb0001',
			'q_rb0002'
		]);
		expect(
			await db.auditLog.findMany({
				where: { action: 'release.preview_built', targetId: 'v2026.10.1' }
			})
		).toMatchObject([
			{ actorId: null, actorHandle: 'mireille', note: '+2 ~0 −0' }
		]);
	});

	it('diffs against the last published release: added, corrected, withdrawn', async () => {
		const kept = await quote('DATASET_RELEASE', 'Kept as it was.');
		const fixed = await quote('DATASET_RELEASE', 'Corrected since.');
		const gone = await quote('WITHDRAWN', 'Withdrawn since.');
		await quote('CURATED', 'New this month.');
		const previous = await release('v2026.09.1', 'PUBLISHED');
		await db.releaseQuote.createMany({
			data: [
				{ releaseId: previous.id, quoteId: kept.id, textAtRelease: kept.text },
				{
					releaseId: previous.id,
					quoteId: fixed.id,
					textAtRelease: 'Corected since.'
				},
				{ releaseId: previous.id, quoteId: gone.id, textAtRelease: gone.text }
			]
		});
		const draft = await release('v2026.10.1');

		const result = await buildPreview(
			db,
			storage,
			{ releaseId: draft.id, actor },
			options
		);
		expect(result.changes).toEqual({
			eligible: 3,
			added: 1,
			corrected: 1,
			withdrawn: 1
		});
	});

	it('rebuilding replaces the preview', async () => {
		await quote('CURATED');
		const draft = await release('v2026.10.1');
		const first = await buildPreview(
			db,
			storage,
			{ releaseId: draft.id, actor },
			options
		);
		await quote('CURATED');
		const second = await buildPreview(
			db,
			storage,
			{ releaseId: draft.id, actor },
			options
		);

		expect(second.sha256).not.toBe(first.sha256);
		const row = await db.release.findUniqueOrThrow({ where: { id: draft.id } });
		expect(row).toMatchObject({
			sha256: second.sha256,
			eligibleCount: 2,
			state: 'PREVIEW'
		});
		expect(
			await db.releaseQuote.count({ where: { releaseId: draft.id } })
		).toBe(2);
	});

	it('never rebuilds a published release, and does not retry', async () => {
		await quote('CURATED');
		const published = await release('v2026.09.1', 'PUBLISHED');
		await expect(
			buildPreview(db, storage, { releaseId: published.id, actor }, options)
		).rejects.toBeInstanceOf(UnrecoverableError);
		const row = await db.release.findUniqueOrThrow({
			where: { id: published.id }
		});
		expect(row).toMatchObject({
			state: 'PUBLISHED',
			sha256: null,
			previewBuiltAt: null
		});
		expect(await db.releaseQuote.count()).toBe(0);
	});

	it('leaves the release as it was when an upload fails', async () => {
		await quote('CURATED');
		const draft = await release('v2026.10.1');
		const failing = {
			...storage,
			put: () => Promise.reject(new Error('storage unavailable')),
			get: storage.get.bind(storage),
			putFile: storage.putFile.bind(storage),
			delete: storage.delete.bind(storage)
		};
		await expect(
			buildPreview(db, failing, { releaseId: draft.id, actor }, options)
		).rejects.toThrow('storage unavailable');
		const row = await db.release.findUniqueOrThrow({ where: { id: draft.id } });
		expect(row).toMatchObject({ state: 'DRAFT', sha256: null });
		expect(await db.releaseQuote.count()).toBe(0);
		expect(await db.auditLog.count()).toBe(0);
	});
});
