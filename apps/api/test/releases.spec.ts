import { AppFactory } from '@test/factory/app';
import {
	publishRelease,
	recordPreview,
	setReleaseQuotes,
	updateRelease
} from 'releases';

const ARTIFACTS = {
	sizeBytes: 2_900_000,
	sha256: '4b7e91'.padEnd(64, '0'),
	artifactKey: 'releases/v2026.09.1/qotm.sqlite',
	manifestKey: 'releases/v2026.09.1/manifest.json'
};

/** Release immutability against the real test database. */
describe('Releases', () => {
	let app: AppFactory;
	let actor: { id: string; handle: string };
	let quoteId: string;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		actor = await app.db.user.findFirstOrThrow({
			select: { id: true, handle: true }
		});
		const quote = await app.db.quote.create({
			data: {
				publicId: 'q_rel001',
				text: 'Simplicity is prerequisite for reliability.',
				type: 'CANONICAL',
				status: 'CURATED'
			}
		});
		quoteId = quote.id;
	});

	afterAll(async () => {
		await app.close();
	});

	function draft(version: string) {
		return app.db.release.create({ data: { version, schemaVersion: 1 } });
	}

	it('lets a draft change, take quotes and become a preview', async () => {
		const release = await draft('v2026.09.1');
		await updateRelease(app.db, release.id, {
			eligibleCount: 1,
			addedCount: 1
		});
		await setReleaseQuotes(app.db, release.id, [
			{ quoteId, textAtRelease: 'Simplicity is prerequisite for reliability.' }
		]);
		await recordPreview(app.db, release.id, ARTIFACTS);

		const after = await app.db.release.findUniqueOrThrow({
			where: { id: release.id },
			include: { quotes: true }
		});
		expect(after).toMatchObject({
			state: 'PREVIEW',
			eligibleCount: 1,
			sha256: ARTIFACTS.sha256
		});
		expect(after.quotes).toHaveLength(1);
	});

	it('will not publish a draft that has no preview', async () => {
		const release = await draft('v2026.09.2');
		await expect(publishRelease(app.db, release.id, actor)).rejects.toThrow(
			'cannot be published while it is draft'
		);
	});

	it('publishes a preview once, audited, and then refuses every change', async () => {
		const release = await draft('v2026.09.3');
		await setReleaseQuotes(app.db, release.id, [
			{ quoteId, textAtRelease: 'Simplicity is prerequisite for reliability.' }
		]);
		await recordPreview(app.db, release.id, ARTIFACTS);

		const published = await publishRelease(app.db, release.id, actor);
		expect(published).toMatchObject({
			state: 'PUBLISHED',
			publishedById: actor.id
		});
		expect(
			await app.db.auditLog.count({
				where: { action: 'release.published', targetId: 'v2026.09.3' }
			})
		).toBe(1);

		const refused = 'Release v2026.09.3 is published and cannot be changed';
		await expect(
			updateRelease(app.db, release.id, { addedCount: 99 })
		).rejects.toThrow(refused);
		await expect(recordPreview(app.db, release.id, ARTIFACTS)).rejects.toThrow(
			refused
		);
		await expect(setReleaseQuotes(app.db, release.id, [])).rejects.toThrow(
			refused
		);
		await expect(publishRelease(app.db, release.id, actor)).rejects.toThrow(
			refused
		);

		// Nothing moved.
		const after = await app.db.release.findUniqueOrThrow({
			where: { id: release.id },
			include: { quotes: true }
		});
		expect(after.addedCount).toBe(published.addedCount);
		expect(after.publishedAt).toEqual(published.publishedAt);
		expect(after.quotes).toHaveLength(1);
	});

	it('lets exactly one of several racing publishes through', async () => {
		const release = await draft('v2026.09.4');
		await recordPreview(app.db, release.id, ARTIFACTS);

		const results = await Promise.allSettled(
			Array.from({ length: 5 }, () => publishRelease(app.db, release.id, actor))
		);
		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
		expect(
			await app.db.auditLog.count({
				where: { action: 'release.published', targetId: 'v2026.09.4' }
			})
		).toBe(1);
	});
});
