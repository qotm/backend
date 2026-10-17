import { AppFactory } from '@test/factory/app';
import { TEST_USER } from '@test/factory/constants';
import { DATASET_LICENSE } from 'dataset/license';
import { syncCounterKey } from 'dataset/services';

/** The dataset manifest and current release, against the real test stack. */
describe('Dataset', () => {
	let app: AppFactory;
	let base: string;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		base = app.config.releases.baseUrl;
	});

	afterAll(async () => {
		await app.close();
	});

	const manifest = () => app.request.get('/v1/dataset/manifest');

	it('404s everything before the first release', async () => {
		await app.db.release.create({
			data: {
				version: 'v2026.09.1',
				schemaVersion: 1,
				state: 'PREVIEW',
				sha256: 'f'.repeat(64)
			}
		});
		expect((await manifest()).status).toBe(404);
		expect((await app.request.get('/v1/releases/current')).status).toBe(404);
		expect((await app.request.get('/v1/dataset/download')).status).toBe(404);
	});

	describe('once a release is published', () => {
		const sha256 = 'b'.repeat(64);

		beforeAll(async () => {
			await app.db.release.deleteMany({});
			await app.db.release.create({
				data: {
					version: 'v2026.09.1',
					schemaVersion: 1,
					state: 'PUBLISHED',
					publishedAt: new Date('2026-09-26T18:02:00.000Z'),
					sizeBytes: 2_900_000,
					sha256,
					eligibleCount: 12701,
					addedCount: 74,
					correctedCount: 9,
					withdrawnCount: 4
				}
			});
			// A newer preview is not current until it is published.
			await app.db.release.create({
				data: {
					version: 'v2026.10.1',
					schemaVersion: 1,
					state: 'PREVIEW',
					sha256: 'c'.repeat(64)
				}
			});
		});

		it('serves the manifest publicly, as the CLI contract has it', async () => {
			const res = await manifest();
			expect(res.status).toBe(200);
			expect(res.body).toEqual({
				version: 'v2026.09.1',
				schemaVersion: 1,
				publishedAt: '2026-09-26T18:02:00.000Z',
				url: `${base}/v2026.09.1/qotm.sqlite`,
				size: 2_900_000,
				sha256,
				changes: { eligible: 12701, added: 74, corrected: 9, withdrawn: 4 },
				license: DATASET_LICENSE
			});
			expect(res.headers['cache-control']).toBe('public, max-age=60');
		});

		it('answers If-None-Match with a 304', async () => {
			const etag = (await manifest()).headers.etag;
			expect(etag).toBe(`"v2026.09.1-${sha256}"`);
			const res = await manifest().set('If-None-Match', etag);
			expect(res.status).toBe(304);
			expect(res.text).toBeFalsy();
			const stale = await manifest().set('If-None-Match', '"v2026.08.3-x"');
			expect(stale.status).toBe(200);
		});

		it('redirects to the file, and describes the release for the Curated page', async () => {
			const res = await app.request.get('/v1/dataset/download').redirects(0);
			expect(res.status).toBe(302);
			expect(res.headers.location).toBe(`${base}/v2026.09.1/qotm.sqlite`);
			expect((await app.request.get('/v1/releases/current')).body).toEqual({
				version: 'v2026.09.1',
				publishedAt: '2026-09-26T18:02:00.000Z',
				schemaVersion: 1,
				quotes: 12701,
				changes: { eligible: 12701, added: 74, corrected: 9, withdrawn: 4 }
			});
		});

		describe('sync tracking', () => {
			const until = async (check: () => Promise<boolean>) => {
				for (let i = 0; i < 50 && !(await check()); i++) {
					await new Promise((r) => setTimeout(r, 20));
				}
			};
			const syncs = async () =>
				Number((await app.cache.fetch(syncCounterKey(new Date()))) ?? 0);

			it('counts every manifest request, signed in or not', async () => {
				const before = await syncs();
				await manifest();
				await manifest().set('X-Qotm-Dataset', 'v2026.08.3');
				await until(async () => (await syncs()) >= before + 2);
				expect(await syncs()).toBe(before + 2);
			});

			it('records the version on the signed-in terminal', async () => {
				const user = await app.db.user.findUniqueOrThrow({
					where: { email: TEST_USER.email }
				});
				const session = await app.db.session.create({
					data: {
						id: 's-sync',
						token: 'token-sync',
						userId: user.id,
						expiresAt: new Date(Date.now() + 86_400_000)
					}
				});
				const device = await app.db.device.create({
					data: {
						userId: user.id,
						label: 'MacBook · zsh',
						sessionId: session.id
					}
				});
				const res = await manifest()
					.set('Authorization', 'Bearer token-sync')
					.set('X-Qotm-Dataset', 'v2026.08.3');
				expect(res.status).toBe(200);
				const synced = () =>
					app.db.device.findUniqueOrThrow({ where: { id: device.id } });
				await until(async () => (await synced()).datasetVersion !== null);
				expect(await synced()).toMatchObject({
					datasetVersion: 'v2026.08.3',
					lastSyncAt: expect.any(Date)
				});

				// A malformed version is not recorded.
				await manifest()
					.set('Authorization', 'Bearer token-sync')
					.set('X-Qotm-Dataset', 'latest');
				await new Promise((r) => setTimeout(r, 100));
				expect((await synced()).datasetVersion).toBe('v2026.08.3');
			});
		});
	});
});
