import { AppFactory } from '@test/factory/app';
import { TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import { auth } from 'lib/auth';
import { RELEASE_ELIGIBLE } from 'releases';
import type { QuoteStatus, ReportStatus } from '@qotm/db/enums';

/** Report moderation against the real test stack. */
describe('Admin reports', () => {
	let app: AppFactory;
	const cookie: Record<'admin' | 'member' | 'moderator' | 'verifier', string> =
		{} as never;
	let reporterId: string;

	async function signInAs(role: 'moderator' | 'verifier') {
		const email = `${role}.r@example.com`;
		await auth.api.createUser({
			body: { name: role, email, password: 'secret', role }
		});
		await app.db.user.update({
			where: { email },
			data: { emailVerified: true }
		});
		return (await app.signIn(email, 'secret')).cookie!;
	}

	let n = 0;
	async function quote(status: QuoteStatus) {
		const publicId = `q_ar${String(++n).padStart(4, '0')}`;
		return app.db.quote.create({
			data: {
				publicId,
				type: 'CANONICAL',
				status,
				text: `Reported ${publicId}`,
				publishedAt: new Date(),
				events: {
					create: { toStatus: status, at: new Date(Date.UTC(2026, 7, 1)) }
				}
			}
		});
	}

	let reportNumber = 9000;
	async function report(
		quoteId: string,
		status: ReportStatus = 'SUBMITTED',
		at = new Date()
	) {
		return app.db.report.create({
			data: {
				number: ++reportNumber,
				quoteId,
				reporterId,
				reason: 'ATTRIBUTION',
				status,
				createdAt: at
			}
		});
	}
	const ref = (r: { number: number }) => `r_${r.number}`;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		cookie.admin = (
			await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password)
		).cookie!;
		cookie.member = (
			await app.signIn(TEST_USER.email, TEST_USER.password)
		).cookie!;
		cookie.moderator = await signInAs('moderator');
		cookie.verifier = await signInAs('verifier');
		reporterId = (
			await app.db.user.findUniqueOrThrow({ where: { email: TEST_USER.email } })
		).id;
	});

	afterAll(async () => {
		await app.close();
	});

	const decide = (
		r: { number: number },
		body: object,
		as: keyof typeof cookie = 'moderator'
	) =>
		app.request
			.post(`/v1/admin/reports/${ref(r)}/decision`)
			.set('Cookie', cookie[as])
			.send(body);

	it.each([
		['moderator', 200],
		['admin', 200],
		['verifier', 403],
		['member', 403]
	] as const)('%s sees the report queue: %i', async (role, status) => {
		expect(
			(await app.request.get('/v1/admin/reports').set('Cookie', cookie[role]))
				.status
		).toBe(status);
	});

	it('lists open reports oldest first, with the reporter and the release the quote is in', async () => {
		const q = await quote('DATASET_RELEASE');
		await app.db.release.create({
			data: {
				version: 'v2026.08.3',
				state: 'PUBLISHED',
				schemaVersion: 1,
				publishedAt: new Date(),
				quotes: { create: { quoteId: q.id, textAtRelease: q.text } }
			}
		});
		const older = await report(
			q.id,
			'SUBMITTED',
			new Date(Date.UTC(2026, 8, 1))
		);
		const newer = await report(
			q.id,
			'UNDER_REVIEW',
			new Date(Date.UTC(2026, 8, 5))
		);
		const res = await app.request
			.get('/v1/admin/reports')
			.set('Cookie', cookie.moderator);
		const ids = res.body.list.map((r: { id: string }) => r.id);
		expect(ids.indexOf(ref(older))).toBeLessThan(ids.indexOf(ref(newer)));
		expect(
			res.body.list.find((r: { id: string }) => r.id === ref(older))
		).toMatchObject({
			reason: 'attribution',
			reporter: 'test_user',
			inRelease: 'v2026.08.3',
			quote: { id: q.publicId }
		});
	});

	it('withdraws a curated quote: out of the next release, every open report resolved, history kept', async () => {
		const q = await quote('CURATED');
		const r1 = await report(q.id);
		const r2 = await report(q.id);
		expect((await decide(r1, { decision: 'withdraw' })).status).toBe(400);

		const res = await decide(r1, {
			decision: 'withdraw',
			note: 'No source found.'
		});
		expect(res.status).toBe(200);
		expect(res.body.status).toBe('WITHDRAWN');
		expect(
			await app.db.quote.count({ where: { id: q.id, ...RELEASE_ELIGIBLE } })
		).toBe(0);
		expect(
			await app.db.report.count({
				where: { id: { in: [r1.id, r2.id] }, status: 'RESOLVED' }
			})
		).toBe(2);
		expect(
			await app.db.reviewDecision.count({
				where: { reportId: r1.id, outcome: 'WITHDRAW' }
			})
		).toBe(1);
		expect(
			await app.db.auditLog.count({
				where: { action: 'quote.withdrawn', targetId: q.publicId }
			})
		).toBe(1);
		expect(await app.db.quoteEvent.count({ where: { quoteId: q.id } })).toBe(2);

		const page = await app.request.get(`/v1/quotes/${q.publicId}`);
		expect(page.status).toBe(404);
		expect(page.body.message).toContain(q.publicId);
	});

	it('disputes a quote (it stays up), then a dismissal restores it', async () => {
		const q = await quote('CURATED');
		const r = await report(q.id);
		expect((await decide(r, { decision: 'mark_disputed' })).status).toBe(400);

		const disputed = await decide(r, {
			decision: 'mark_disputed',
			note: 'Looking for the source.'
		});
		expect(disputed.body.status).toBe('DISPUTED');
		expect(
			(await app.db.report.findUniqueOrThrow({ where: { id: r.id } })).status
		).toBe('DISPUTED');
		expect((await app.request.get(`/v1/quotes/${q.publicId}`)).status).toBe(
			200
		);

		const dismissed = await decide(r, {
			decision: 'dismiss',
			note: 'Source found: EWD 498.'
		});
		expect(dismissed.body.status).toBe('CURATED');
		expect(
			(await app.db.report.findUniqueOrThrow({ where: { id: r.id } })).status
		).toBe('RESOLVED');
		expect(
			await app.db.auditLog.count({
				where: { action: 'quote.restored', targetId: q.publicId }
			})
		).toBe(1);
		expect(
			await app.db.auditLog.count({
				where: { action: 'report.resolved', targetId: ref(r) }
			})
		).toBe(1);
	});

	it('keeps a quote disputed while another report still holds it there', async () => {
		const q = await quote('VERIFIED');
		const a = await report(q.id);
		const b = await report(q.id);
		await decide(a, { decision: 'mark_disputed', note: 'Checking.' });
		await decide(b, { decision: 'mark_disputed', note: 'Also checking.' });
		const res = await decide(a, { decision: 'dismiss' });
		expect(res.body.status).toBe('DISPUTED');
	});

	it('dismisses a report and leaves the quote alone', async () => {
		const q = await quote('VERIFIED');
		const r = await report(q.id);
		const res = await decide(r, { decision: 'dismiss' });
		expect(res.body.status).toBe('VERIFIED');
		expect(
			await app.db.reviewDecision.count({
				where: { reportId: r.id, outcome: 'PUBLISH' }
			})
		).toBe(1);
	});

	it('refuses a resolved or unknown report, and a verifier', async () => {
		const q = await quote('VERIFIED');
		const r = await report(q.id, 'RESOLVED');
		expect((await decide(r, { decision: 'dismiss' })).status).toBe(409);
		expect(
			(await decide({ number: 99999 }, { decision: 'dismiss' })).status
		).toBe(404);
		const open = await report(q.id);
		expect(
			(await decide(open, { decision: 'dismiss' }, 'verifier')).status
		).toBe(403);
	});

	it('lists resolved reports on request', async () => {
		const res = await app.request
			.get('/v1/admin/reports?status=resolved')
			.set('Cookie', cookie.admin);
		expect(res.body.list.length).toBeGreaterThan(0);
		expect(
			res.body.list.every((r: { status: string }) => r.status === 'RESOLVED')
		).toBe(true);
	});
});
