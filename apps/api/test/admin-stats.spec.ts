import { of, throwError } from 'rxjs';
import type { AxiosResponse } from 'axios';
import { AppFactory } from '@test/factory/app';
import { TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import { auth } from 'lib/auth';
import { syncCounterKey } from 'dataset/services';
import {
	COUNTS_KEY,
	NPM_DOWNLOADS_URL,
	NPM_KEY,
	ROLLUP_KEY,
	StatsService
} from 'admin/stats/services';
import type { QuoteStatus, QuoteType } from '@qotm/db/enums';

/** Admin › Dashboard and the sidebar counts, against the real test stack. */
describe('Admin stats', () => {
	let app: AppFactory;
	let admin: string;
	let verifier: string;
	let member: string;
	let memberId: string;
	let stats: StatsService;

	const DAY = 86_400_000;
	const ago = (days: number) => new Date(Date.now() - days * DAY);

	let n = 0;
	async function quote(
		status: QuoteStatus,
		type: QuoteType = 'CANONICAL',
		since = ago(1),
		extra: { createdAt?: Date; publishedAt?: Date } = {}
	) {
		return app.db.quote.create({
			data: {
				publicId: `q_st${String(++n).padStart(4, '0')}`,
				text: `Stats quote ${n}`,
				type,
				status,
				contributorId: memberId,
				createdAt: extra.createdAt ?? since,
				publishedAt: extra.publishedAt ?? null,
				events: { create: { toStatus: status, at: since } }
			}
		});
	}

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		stats = app.instance.get(StatsService);
		admin = (await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password)).cookie!;
		member = (await app.signIn(TEST_USER.email, TEST_USER.password)).cookie!;
		memberId = (
			await app.db.user.findUniqueOrThrow({ where: { email: TEST_USER.email } })
		).id;
		const email = 'verifier.st@example.com';
		await auth.api.createUser({
			body: { name: 'V', email, password: 'secret', role: 'verifier' }
		});
		await app.db.user.update({
			where: { email },
			data: { emailVerified: true }
		});
		verifier = (await app.signIn(email, 'secret')).cookie!;

		// The queues.
		await quote('SUBMITTED', 'CANONICAL', ago(3)); // verification
		await quote('NEEDS_EVIDENCE', 'CANONICAL', ago(6)); // verification, oldest
		await quote('ORIGINALITY_CHECK', 'ORIGINAL', ago(2)); // submissions
		await quote('VERIFIED', 'CANONICAL', ago(4)); // curation
		await quote('CURATION_CANDIDATE', 'ORIGINAL', ago(2)); // curation
		const curated = await quote('CURATED', 'CANONICAL', ago(5), {
			publishedAt: ago(5)
		});
		await app.db.report.create({
			data: {
				quoteId: curated.id,
				reason: 'ATTRIBUTION',
				createdAt: ago(3)
			}
		});

		// The period's decisions.
		for (const outcome of ['VERIFY', 'VERIFY', 'REJECT'] as const) {
			await app.db.reviewDecision.create({
				data: { kind: 'VERIFICATION', outcome, quoteId: curated.id }
			});
		}
		await app.db.reviewDecision.create({
			data: { kind: 'CURATION', outcome: 'CURATE', quoteId: curated.id }
		});
		await app.db.reviewDecision.create({
			data: {
				kind: 'VERIFICATION',
				outcome: 'VERIFY',
				quoteId: curated.id,
				createdAt: ago(40) // outside the period
			}
		});
	});

	afterAll(async () => {
		await app.close();
	});

	const get = (path: string, cookie = admin) =>
		app.request.get(path).set('Cookie', cookie);

	it('shows the dashboard to admins, and the sidebar counts to reviewers', async () => {
		expect((await app.request.get('/v1/admin/stats')).status).toBe(401);
		for (const path of [
			'/v1/admin/stats',
			'/v1/admin/stats/counts',
			'/v1/admin/queues/oldest'
		]) {
			expect((await get(path, member)).status).toBe(403);
			expect((await get(path)).status).toBe(200);
		}
		expect((await get('/v1/admin/stats/counts', verifier)).status).toBe(200);
		expect((await get('/v1/admin/stats', verifier)).status).toBe(403);
		expect((await get('/v1/admin/queues/oldest', verifier)).status).toBe(403);
	});

	it('counts the queues for the sidebar, from a 30-second cache', async () => {
		await app.cache.delete(COUNTS_KEY);
		const res = await get('/v1/admin/stats/counts');
		expect(res.body).toEqual({
			verification: 2,
			curation: 2,
			reports: 1,
			submissions: 1
		});
		await quote('SUBMITTED');
		expect((await get('/v1/admin/stats/counts')).body.verification).toBe(2);
		await app.cache.delete(COUNTS_KEY);
		expect((await get('/v1/admin/stats/counts')).body.verification).toBe(3);
		await app.db.quote.deleteMany({
			where: { publicId: `q_st${String(n).padStart(4, '0')}` }
		});
	});

	it('describes each queue as the dashboard cards do', async () => {
		const { queues } = (await get('/v1/admin/stats')).body;
		expect(queues.verification).toMatchObject({ count: 2, needsEvidence: 1 });
		expect(new Date(queues.verification.oldestSince).getTime()).toBeCloseTo(
			ago(6).getTime(),
			-4
		);
		expect(queues.curation).toMatchObject({ count: 2, communityCandidates: 1 });
		expect(queues.reports).toMatchObject({ count: 1, onCurated: 1 });
		expect(queues.submissions).toMatchObject({
			count: 1,
			originalityChecks: 1
		});
	});

	it('rolls up the 30-day figures idempotently', async () => {
		await app.cache.store(syncCounterKey(ago(0)), '40', 3600);
		await app.cache.store(syncCounterKey(ago(5)), '2', 3600);
		await app.cache.store(syncCounterKey(ago(35)), '1000', 3600); // outside
		// A returning contributor: submitted before the period and in it.
		await quote('DATASET_RELEASE', 'CANONICAL', ago(60));

		const first = await stats.rollUp();
		const second = await stats.rollUp();
		expect({ ...second.quality, ...second.community }).toEqual({
			...first.quality,
			...first.community
		});
		expect(first.quality).toEqual({
			verificationAcceptance: 0.667,
			duplicateRate: 0,
			curated: 1,
			usefulContributionsPer100Users: expect.any(Number)
		});
		expect(first.community).toEqual({
			datasetSyncs: 42,
			registrations: await app.db.user.count(),
			returningContributors: 1
		});
		expect(await app.cache.fetch(ROLLUP_KEY)).toMatchObject({
			community: { datasetSyncs: 42 }
		});

		const res = await get('/v1/admin/stats');
		expect(res.body.community).toMatchObject({
			datasetSyncs: 42,
			npmDownloads: null
		});
	});

	it('serves npm downloads fetched once a day, keeping the last value on failure', async () => {
		const http = (stats as unknown as { http: { get: unknown } }).http as {
			get: (url: string) => unknown;
		};
		const getSpy = vi
			.spyOn(http, 'get')
			.mockReturnValueOnce(
				of({
					data: { downloads: 1840, start: '2026-09-11', end: '2026-10-10' }
				} as AxiosResponse)
			)
			.mockReturnValueOnce(throwError(() => new Error('npm down')));
		expect(await stats.refreshNpmDownloads()).toMatchObject({
			downloads: 1840
		});
		expect(getSpy).toHaveBeenCalledWith(NPM_DOWNLOADS_URL);
		expect(await stats.refreshNpmDownloads()).toBeNull();
		expect(await app.cache.fetch(NPM_KEY)).toMatchObject({ downloads: 1840 });
		expect((await get('/v1/admin/stats')).body.community.npmDownloads).toBe(
			1840
		);
	});

	it('lists the oldest items across queues, reports included', async () => {
		const res = await get('/v1/admin/queues/oldest');
		expect(res.body.list.slice(0, 3)).toEqual([
			expect.objectContaining({
				queue: 'verification',
				state: 'NEEDS_EVIDENCE'
			}),
			expect.objectContaining({ queue: 'curation', state: 'VERIFIED' }),
			expect.objectContaining({ queue: 'verification', state: 'SUBMITTED' })
		]);
		expect(res.body.list).toContainEqual(
			expect.objectContaining({
				id: expect.stringMatching(/^r_\d{4,}$/),
				queue: 'reports',
				state: 'SUBMITTED'
			})
		);
	});
});
