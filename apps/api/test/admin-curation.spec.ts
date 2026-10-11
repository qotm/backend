import { AppFactory } from '@test/factory/app';
import { TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import { auth } from 'lib/auth';
import { RELEASE_ELIGIBLE } from 'releases';
import { CURATION_CHECKLIST } from 'review';
import type { QuoteStatus, QuoteType } from '@qotm/db/enums';

const ALL_TICKED = Object.fromEntries(
	Object.keys(CURATION_CHECKLIST).map((key) => [key, true])
);

/** The curation queue against the real test stack. */
describe('Admin curation', () => {
	let app: AppFactory;
	let admin: string;
	let verifier: string;
	let member: string;
	let memberId: string;

	let n = 0;
	async function quote(type: QuoteType, status: QuoteStatus, counts = {}) {
		const publicId = `q_cu${String(++n).padStart(4, '0')}`;
		return app.db.quote.create({
			data: {
				publicId,
				type,
				status,
				text: `Curation quote ${publicId}`,
				contributorId: memberId,
				publishedAt: new Date(),
				...counts,
				events: {
					create: { toStatus: status, at: new Date(Date.UTC(2026, 8, n)) }
				}
			}
		});
	}

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		admin = (await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password)).cookie!;
		member = (await app.signIn(TEST_USER.email, TEST_USER.password)).cookie!;
		await auth.api.createUser({
			body: {
				name: 'v',
				email: 'verifier@example.com',
				password: 'secret',
				role: 'verifier'
			}
		});
		await app.db.user.update({
			where: { email: 'verifier@example.com' },
			data: { emailVerified: true }
		});
		verifier = (await app.signIn('verifier@example.com', 'secret')).cookie!;
		memberId = (
			await app.db.user.findUniqueOrThrow({ where: { email: TEST_USER.email } })
		).id;
	});

	afterAll(async () => {
		await app.close();
	});

	const decide = (id: string, body: object, cookie = admin) =>
		app.request
			.post(`/v1/admin/quotes/${id}/curation`)
			.set('Cookie', cookie)
			.send(body);
	const queueIds = async () =>
		(
			await app.request.get('/v1/admin/curation').set('Cookie', admin)
		).body.list.map((q: { id: string }) => q.id);

	it('is an admin’s queue only', async () => {
		expect(
			(await app.request.get('/v1/admin/curation').set('Cookie', admin)).status
		).toBe(200);
		for (const cookie of [verifier, member]) {
			expect(
				(await app.request.get('/v1/admin/curation').set('Cookie', cookie))
					.status
			).toBe(403);
		}
		const q = await quote('CANONICAL', 'VERIFIED');
		expect(
			(
				await decide(
					q.publicId,
					{ decision: 'curate', checklist: ALL_TICKED },
					verifier
				)
			).status
		).toBe(403);
	});

	it('holds verified quotes and community candidates, with their popularity', async () => {
		const verified = await quote('CANONICAL', 'VERIFIED');
		const candidate = await quote('ORIGINAL', 'CURATION_CANDIDATE', {
			likeCount: 58,
			recommendCount: 14
		});
		const inReview = await quote('CANONICAL', 'CURATION_REVIEW');
		const community = await quote('ORIGINAL', 'COMMUNITY_DISCOVERY');
		const ids = await queueIds();
		expect(ids).toEqual(
			expect.arrayContaining([
				verified.publicId,
				candidate.publicId,
				inReview.publicId
			])
		);
		expect(ids).not.toContain(community.publicId);

		const res = await app.request
			.get('/v1/admin/curation')
			.set('Cookie', admin);
		const item = res.body.list.find(
			(q: { id: string }) => q.id === candidate.publicId
		);
		expect(item.counts).toMatchObject({ likes: 58, recommends: 14 });
	});

	it('curates with the whole checklist: stored, audited, and release-eligible', async () => {
		const q = await quote('CANONICAL', 'VERIFIED');
		const res = await decide(q.publicId, {
			decision: 'curate',
			checklist: ALL_TICKED
		});
		expect(res.status).toBe(200);
		expect(res.body.status).toBe('CURATED');
		expect(res.body.lifecycle.map((e: { status: string }) => e.status)).toEqual(
			['VERIFIED', 'CURATION_REVIEW', 'CURATED']
		);

		const decision = await app.db.reviewDecision.findFirstOrThrow({
			where: { quoteId: q.id }
		});
		expect(decision).toMatchObject({
			kind: 'CURATION',
			outcome: 'CURATE',
			checklist: ALL_TICKED
		});
		expect(
			await app.db.auditLog.count({
				where: { action: 'quote.curated', targetId: q.publicId }
			})
		).toBe(1);
		expect(
			await app.db.quote.count({ where: { id: q.id, ...RELEASE_ELIGIBLE } })
		).toBe(1);
		expect(await queueIds()).not.toContain(q.publicId);
	});

	it('will not curate with an item unticked, naming it', async () => {
		const q = await quote('CANONICAL', 'VERIFIED');
		const res = await decide(q.publicId, {
			decision: 'curate',
			checklist: { ...ALL_TICKED, lasting: false }
		});
		expect(res.status).toBe(409);
		expect(res.body.message).toContain('Will still read well in five years');
		expect(
			(await app.db.quote.findUniqueOrThrow({ where: { id: q.id } })).status
		).toBe('VERIFIED');
	});

	it('needs every checklist item answered', async () => {
		const q = await quote('CANONICAL', 'VERIFIED');
		const partial: Record<string, boolean> = { ...ALL_TICKED };
		delete partial.lasting;
		expect(
			(await decide(q.publicId, { decision: 'curate', checklist: partial }))
				.status
		).toBe(400);
		expect(
			(
				await decide(q.publicId, {
					decision: 'curate',
					checklist: { ...ALL_TICKED, extra: true }
				})
			).status
		).toBe(400);
	});

	it('will not curate a quote with an open report', async () => {
		const q = await quote('CANONICAL', 'VERIFIED');
		await app.db.report.create({
			data: { quoteId: q.id, reason: 'ATTRIBUTION', status: 'UNDER_REVIEW' }
		});
		const res = await decide(q.publicId, {
			decision: 'curate',
			checklist: ALL_TICKED
		});
		expect(res.status).toBe(409);
		expect(res.body.message).toContain('open reports');
	});

	it('keeps a quote out with a note: canonical back to verified, and out of the queue for good', async () => {
		const q = await quote('CANONICAL', 'VERIFIED');
		expect(
			(
				await decide(q.publicId, {
					decision: 'keep_out',
					checklist: ALL_TICKED
				})
			).status
		).toBe(400);
		const res = await decide(q.publicId, {
			decision: 'keep_out',
			checklist: { ...ALL_TICKED, stands_alone: false },
			note: 'Needs its surrounding paragraph.'
		});
		expect(res.body.status).toBe('VERIFIED');
		expect(await queueIds()).not.toContain(q.publicId);
		expect(
			await app.db.quote.count({ where: { id: q.id, ...RELEASE_ELIGIBLE } })
		).toBe(0);
	});

	it('returns a kept-out original to the community', async () => {
		const q = await quote('ORIGINAL', 'CURATION_CANDIDATE');
		const res = await decide(q.publicId, {
			decision: 'keep_out',
			checklist: ALL_TICKED,
			note: 'Too close to an existing quote.'
		});
		expect(res.body.status).toBe('COMMUNITY_DISCOVERY');
	});

	it('refuses a quote that is not waiting for curation', async () => {
		const q = await quote('CANONICAL', 'UNDER_REVIEW');
		expect(
			(await decide(q.publicId, { decision: 'curate', checklist: ALL_TICKED }))
				.status
		).toBe(409);
	});
});
