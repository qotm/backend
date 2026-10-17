import { AppFactory } from '@test/factory/app';
import { TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import { auth } from 'lib/auth';
import type { QuoteStatus, QuoteType } from '@qotm/db/enums';

/** The submissions and verification queues against the real test stack. */
describe('Admin review queues', () => {
	let app: AppFactory;
	const cookies: Record<'member' | 'verifier' | 'moderator' | 'admin', string> =
		{} as never;
	let memberId: string;

	async function signInAs(role: 'verifier' | 'moderator') {
		const email = `${role}@example.com`;
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
	async function quote(
		type: QuoteType,
		status: QuoteStatus,
		extra: { authorId?: string; text?: string; contributorId?: string } = {}
	) {
		const publicId = `q_rv${String(++n).padStart(4, '0')}`;
		return app.db.quote.create({
			data: {
				publicId,
				type,
				status,
				text: extra.text ?? `Review quote ${publicId}`,
				attribution: 'Edsger W. Dijkstra',
				authorId: extra.authorId ?? null,
				contributorId: extra.contributorId ?? memberId,
				// Each quote entered its queue a day after the previous one.
				events: {
					create: { toStatus: status, at: new Date(Date.UTC(2026, 8, n)) }
				}
			}
		});
	}

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		cookies.member = (
			await app.signIn(TEST_USER.email, TEST_USER.password)
		).cookie!;
		cookies.admin = (
			await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password)
		).cookie!;
		cookies.verifier = await signInAs('verifier');
		cookies.moderator = await signInAs('moderator');
		memberId = (
			await app.db.user.findUniqueOrThrow({ where: { email: TEST_USER.email } })
		).id;
		await app.db.author.create({
			data: { slug: 'dijkstra', name: 'Edsger W. Dijkstra' }
		});
	});

	afterAll(async () => {
		await app.close();
	});

	const as = (role: keyof typeof cookies) => ({
		get: (url: string) => app.request.get(url).set('Cookie', cookies[role]),
		post: (url: string, body: object) =>
			app.request.post(url).set('Cookie', cookies[role]).send(body),
		patch: (url: string, body: object) =>
			app.request.patch(url).set('Cookie', cookies[role]).send(body)
	});

	describe('who may see which queue', () => {
		it.each([
			['member', 403, 403],
			['verifier', 403, 200],
			['moderator', 200, 403],
			['admin', 200, 200]
		] as const)(
			'%s: submissions %i, verification %i',
			async (role, submissions, verification) => {
				expect((await as(role).get('/v1/admin/submissions')).status).toBe(
					submissions
				);
				expect((await as(role).get('/v1/admin/verification')).status).toBe(
					verification
				);
			}
		);

		it('turns away anonymous requests', async () => {
			expect((await app.request.get('/v1/admin/verification')).status).toBe(
				401
			);
		});
	});

	describe('verification', () => {
		it('lists canonical quotes waiting for a verifier, longest-waiting first', async () => {
			const a = await quote('CANONICAL', 'SUBMITTED');
			const b = await quote('CANONICAL', 'UNDER_REVIEW');
			await quote('ORIGINAL', 'ORIGINALITY_CHECK');
			await quote('CANONICAL', 'VERIFIED');
			const res = await as('verifier').get('/v1/admin/verification');
			const ids = res.body.list.map((q: { id: string }) => q.id);
			expect(ids.indexOf(a.publicId)).toBeLessThan(ids.indexOf(b.publicId));
			expect(
				res.body.list.every((q: { type: string }) => q.type === 'canonical')
			).toBe(true);
			expect(res.body.list[0]).toHaveProperty('waitingSince');
		});

		it('will not verify a quote whose author is not linked', async () => {
			const q = await quote('CANONICAL', 'UNDER_REVIEW');
			const res = await as('verifier').post(
				`/v1/admin/quotes/${q.publicId}/verification`,
				{ decision: 'verify' }
			);
			expect(res.status).toBe(409);
			expect(res.body.message).toContain('Edsger W. Dijkstra');
		});

		it('links the author, verifies, and writes the decision, events and audit row together', async () => {
			const q = await quote('CANONICAL', 'SUBMITTED');
			const linked = await as('verifier').patch(
				`/v1/admin/quotes/${q.publicId}`,
				{ author: 'dijkstra', note: 'Linked the author' }
			);
			expect(linked.status).toBe(200);
			expect(linked.body.author).toMatchObject({ slug: 'dijkstra' });

			const res = await as('verifier').post(
				`/v1/admin/quotes/${q.publicId}/verification`,
				{ decision: 'verify' }
			);
			expect(res.status).toBe(200);
			expect(res.body).toMatchObject({
				status: 'VERIFIED',
				verifier: { handle: 'verifier' }
			});
			expect(res.body.publishedAt).not.toBeNull();
			expect(
				res.body.lifecycle.map((e: { status: string }) => e.status)
			).toEqual(['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED']);

			expect(
				await app.db.reviewDecision.count({
					where: { quoteId: q.id, kind: 'VERIFICATION', outcome: 'VERIFY' }
				})
			).toBe(1);
			expect(
				await app.db.auditLog.count({
					where: {
						action: 'quote.verified',
						targetId: q.publicId,
						actorHandle: 'verifier'
					}
				})
			).toBe(1);
		});

		it('asks for evidence with a note the submitter sees, and needs that note', async () => {
			const q = await quote('CANONICAL', 'UNDER_REVIEW');
			const url = `/v1/admin/quotes/${q.publicId}/verification`;
			expect(
				(await as('verifier').post(url, { decision: 'needs_evidence' })).status
			).toBe(400);
			const res = await as('verifier').post(url, {
				decision: 'needs_evidence',
				note: 'A verifier needs a primary source.'
			});
			expect(res.body.status).toBe('NEEDS_EVIDENCE');

			const mine = await as('member').get('/v1/me/quotes?tab=review');
			const item = mine.body.list.find(
				(x: { id: string }) => x.id === q.publicId
			);
			expect(item.review).toMatchObject({
				note: 'A verifier needs a primary source.',
				by: 'verifier'
			});

			// Waiting on the submitter now, not on a verifier.
			expect(
				(
					await as('verifier').post(url, {
						decision: 'reject',
						note: 'No source.'
					})
				).status
			).toBe(409);
		});

		it('rejects with a note', async () => {
			const q = await quote('CANONICAL', 'UNDER_REVIEW');
			const res = await as('verifier').post(
				`/v1/admin/quotes/${q.publicId}/verification`,
				{ decision: 'reject', note: 'Misattributed.' }
			);
			expect(res.body.status).toBe('REJECTED');
			expect(
				await app.db.auditLog.count({
					where: { action: 'quote.rejected', targetId: q.publicId }
				})
			).toBe(1);
		});

		it('is not a moderator’s or a member’s decision', async () => {
			const q = await quote('CANONICAL', 'UNDER_REVIEW', {});
			for (const role of ['moderator', 'member'] as const) {
				expect(
					(
						await as(role).post(`/v1/admin/quotes/${q.publicId}/verification`, {
							decision: 'reject',
							note: 'nope'
						})
					).status
				).toBe(403);
			}
		});

		it('is not a verifier’s own submission to decide; an admin may decide theirs', async () => {
			const author = await app.db.author.findUniqueOrThrow({
				where: { slug: 'dijkstra' }
			});
			const idOf = async (email: string) =>
				(await app.db.user.findUniqueOrThrow({ where: { email } })).id;
			const own = await quote('CANONICAL', 'UNDER_REVIEW', {
				authorId: author.id,
				contributorId: await idOf('verifier@example.com')
			});
			const refused = await as('verifier').post(
				`/v1/admin/quotes/${own.publicId}/verification`,
				{ decision: 'verify', note: 'Mine, checked' }
			);
			expect(refused.status).toBe(409);
			expect(refused.body.message).toBe(
				'Someone else must review your own submission'
			);
			const fixed = await as('verifier').patch(
				`/v1/admin/quotes/${own.publicId}`,
				{
					text: 'Changed by its own submitter.',
					note: 'Mine'
				}
			);
			expect(fixed.status).toBe(409);

			const admins = await quote('CANONICAL', 'UNDER_REVIEW', {
				authorId: author.id,
				contributorId: await idOf(TEST_ADMIN.email)
			});
			expect(
				(
					await as('admin').post(
						`/v1/admin/quotes/${admins.publicId}/verification`,
						{
							decision: 'verify',
							note: 'Checked against the source'
						}
					)
				).status
			).toBe(200);
		});

		it('lets exactly one of two racing decisions through, with nothing half-written', async () => {
			const author = await app.db.author.findUniqueOrThrow({
				where: { slug: 'dijkstra' }
			});
			const q = await quote('CANONICAL', 'UNDER_REVIEW', {
				authorId: author.id
			});
			const url = `/v1/admin/quotes/${q.publicId}/verification`;
			const results = await Promise.all([
				as('verifier').post(url, { decision: 'verify' }),
				as('admin').post(url, { decision: 'reject', note: 'Too late.' })
			]);
			expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
			expect(
				await app.db.reviewDecision.count({ where: { quoteId: q.id } })
			).toBe(1);
			expect(
				await app.db.auditLog.count({ where: { targetId: q.publicId } })
			).toBe(1);
			expect(await app.db.quoteEvent.count({ where: { quoteId: q.id } })).toBe(
				2
			);
		});
	});

	describe('a quote for review', () => {
		it('shows a quote in any status with its history and notes, to verifiers and admins', async () => {
			const q = await quote('CANONICAL', 'NEEDS_EVIDENCE');
			await app.db.quoteEvent.create({
				data: {
					quoteId: q.id,
					fromStatus: 'NEEDS_EVIDENCE',
					toStatus: 'UNDER_REVIEW',
					actorId: memberId,
					note: 'EWD 498, page 2.',
					at: new Date(Date.UTC(2026, 9, 1))
				}
			});
			for (const role of ['verifier', 'admin'] as const) {
				const res = await as(role).get(`/v1/admin/quotes/${q.publicId}`);
				expect(res.status).toBe(200);
				expect(res.body).toMatchObject({
					id: q.publicId,
					status: 'NEEDS_EVIDENCE',
					attribution: 'Edsger W. Dijkstra',
					history: [
						{ status: 'NEEDS_EVIDENCE', note: null, by: null },
						{
							status: 'UNDER_REVIEW',
							note: 'EWD 498, page 2.',
							by: { handle: expect.any(String) }
						}
					]
				});
			}
		});

		it('is staff only, and never shows a private quote', async () => {
			const q = await quote('CANONICAL', 'SUBMITTED');
			expect(
				(await as('member').get(`/v1/admin/quotes/${q.publicId}`)).status
			).toBe(403);
			expect(
				(await as('moderator').get(`/v1/admin/quotes/${q.publicId}`)).status
			).toBe(403);
			const p = await quote('PRIVATE', 'PRIVATE');
			expect(
				(await as('admin').get(`/v1/admin/quotes/${p.publicId}`)).status
			).toBe(404);
			expect((await as('admin').get('/v1/admin/quotes/q_nope00')).status).toBe(
				404
			);
		});
	});

	describe('corrections', () => {
		it('keeps the old wording as a Correction and audits it', async () => {
			const q = await quote('CANONICAL', 'VERIFIED', {
				text: 'Premature optimisation is the root of all evil.'
			});
			const res = await as('verifier').patch(`/v1/admin/quotes/${q.publicId}`, {
				text: 'Premature optimization is the root of all evil.',
				note: 'Matched to the 1974 paper'
			});
			expect(res.status).toBe(200);
			expect(res.body.text).toBe(
				'Premature optimization is the root of all evil.'
			);
			expect(
				await app.db.correction.findFirst({ where: { quoteId: q.id } })
			).toMatchObject({
				oldText: 'Premature optimisation is the root of all evil.',
				note: 'Matched to the 1974 paper'
			});
			expect(
				await app.db.auditLog.count({
					where: { action: 'quote.corrected', targetId: q.publicId }
				})
			).toBe(1);
		});

		it('shows the earlier wording and its date on the public page, never the note', async () => {
			const q = await quote('CANONICAL', 'VERIFIED', {
				text: 'Simplicity is prerequisit for reliability.'
			});
			await as('verifier').patch(`/v1/admin/quotes/${q.publicId}`, {
				text: 'Simplicity is prerequisite for reliability.',
				note: 'Typo in prerequisite'
			});
			const page = await app.request.get(`/v1/quotes/${q.publicId}`);
			expect(page.body.corrections).toEqual([
				{
					before: 'Simplicity is prerequisit for reliability.',
					at: expect.any(String)
				}
			]);
			expect(JSON.stringify(page.body)).not.toContain('Typo in prerequisite');
		});

		it('is a verifier’s or admin’s, and 404s an unknown author', async () => {
			const q = await quote('CANONICAL', 'VERIFIED');
			const body = { text: 'Changed.', note: 'Why not' };
			expect(
				(await as('moderator').patch(`/v1/admin/quotes/${q.publicId}`, body))
					.status
			).toBe(403);
			expect(
				(await as('member').patch(`/v1/admin/quotes/${q.publicId}`, body))
					.status
			).toBe(403);
			expect(
				(
					await as('admin').patch(`/v1/admin/quotes/${q.publicId}`, {
						author: 'nobody',
						note: 'Link'
					})
				).status
			).toBe(404);
		});
	});

	describe('submissions and moderation', () => {
		let held: { id: string; publicId: string };
		let canonical: { id: string; publicId: string };

		beforeAll(async () => {
			canonical = await quote('CANONICAL', 'VERIFIED', {
				text: 'Make it work, make it right, make it fast.'
			});
			held = await quote('ORIGINAL', 'ORIGINALITY_CHECK', {
				text: 'Make it work, make it right, make it fast!'
			});
			await app.db.matchResult.create({
				data: {
					quoteId: held.id,
					matchedQuoteId: canonical.id,
					method: 'EXACT',
					score: 1
				}
			});
		});

		it('lists held originals with their best match, and every match on request', async () => {
			const res = await as('moderator').get('/v1/admin/submissions');
			const item = res.body.list.find(
				(q: { id: string }) => q.id === held.publicId
			);
			expect(item.match).toMatchObject({
				id: canonical.publicId,
				method: 'exact',
				score: 1
			});

			const matches = await as('moderator').get(
				`/v1/admin/submissions/${held.publicId}/match`
			);
			expect(matches.body).toMatchObject({
				submitted: { id: held.publicId },
				matches: [{ id: canonical.publicId, dismissed: false }]
			});
		});

		it('publishes over the match, dismissing it, and audits the decision', async () => {
			const res = await as('moderator').post(
				`/v1/admin/submissions/${held.publicId}/decision`,
				{ decision: 'publish' }
			);
			expect(res.status).toBe(200);
			expect(res.body.status).toBe('PUBLISHED');
			expect(
				(
					await app.db.matchResult.findFirstOrThrow({
						where: { quoteId: held.id }
					})
				).dismissedAt
			).not.toBeNull();
			expect(
				await app.db.reviewDecision.count({
					where: { quoteId: held.id, kind: 'MODERATION', outcome: 'PUBLISH' }
				})
			).toBe(1);
			expect(
				await app.db.auditLog.count({
					where: { action: 'quote.published', targetId: held.publicId }
				})
			).toBe(1);
		});

		it.each([
			['withdraw', 'WITHDRAWN'],
			['mark_disputed', 'DISPUTED']
		])('%s needs a note and ends %s', async (decision, status) => {
			const q = await quote('ORIGINAL', 'ORIGINALITY_CHECK');
			const url = `/v1/admin/submissions/${q.publicId}/decision`;
			expect((await as('moderator').post(url, { decision })).status).toBe(400);
			const res = await as('moderator').post(url, {
				decision,
				note: 'Duplicate of a known quote.'
			});
			expect(res.body.status).toBe(status);
		});

		it('refuses an original that is not waiting for a moderator, and a verifier', async () => {
			expect(
				(
					await as('moderator').post(
						`/v1/admin/submissions/${held.publicId}/decision`,
						{ decision: 'publish' }
					)
				).status
			).toBe(409);
			const q = await quote('ORIGINAL', 'ORIGINALITY_CHECK');
			expect(
				(
					await as('verifier').post(
						`/v1/admin/submissions/${q.publicId}/decision`,
						{ decision: 'publish' }
					)
				).status
			).toBe(403);
		});
	});

	it('answers the page that holds a focused item, so a link opens it in place', async () => {
		const all = await as('admin').get('/v1/admin/verification?limit=50');
		expect(all.body.list.length).toBeGreaterThan(1);
		const second = all.body.list[1].id;
		const res = await as('admin').get(
			`/v1/admin/verification?limit=1&focus=${second}`
		);
		expect(res.body.currentPage).toBe(2);
		expect(res.body.list.map((q: { id: string }) => q.id)).toEqual([second]);
		// Not in the queue: the asked page.
		const away = await as('admin').get(
			'/v1/admin/verification?limit=1&page=1&focus=q_notqueued'
		);
		expect(away.body.currentPage).toBe(1);
	});

	describe('nominating an original for curation', () => {
		it('makes a published original a curation candidate, step by step, and audits it', async () => {
			const q = await quote('ORIGINAL', 'PUBLISHED');
			const res = await as('admin').post(
				`/v1/admin/quotes/${q.publicId}/nomination`,
				{
					note: 'Worth a look'
				}
			);
			expect(res.status).toBe(200);
			expect(res.body.status).toBe('CURATION_CANDIDATE');
			const events = await app.db.quoteEvent.findMany({
				where: { quoteId: q.id },
				orderBy: { at: 'asc' },
				select: { toStatus: true }
			});
			expect(events.map((e) => e.toStatus)).toEqual([
				'PUBLISHED',
				'COMMUNITY_DISCOVERY',
				'CURATION_CANDIDATE'
			]);
			expect(
				await app.db.auditLog.count({
					where: { action: 'quote.nominated', targetId: q.publicId }
				})
			).toBe(1);
			// Already a candidate: nothing more to nominate.
			expect(
				(
					await as('admin').post(
						`/v1/admin/quotes/${q.publicId}/nomination`,
						{}
					)
				).status
			).toBe(409);
		});

		it('refuses a canonical quote, and is a curator’s', async () => {
			const canonical = await quote('CANONICAL', 'VERIFIED');
			expect(
				(
					await as('admin').post(
						`/v1/admin/quotes/${canonical.publicId}/nomination`,
						{}
					)
				).status
			).toBe(409);
			const original = await quote('ORIGINAL', 'PUBLISHED');
			expect(
				(
					await as('verifier').post(
						`/v1/admin/quotes/${original.publicId}/nomination`,
						{}
					)
				).status
			).toBe(403);
		});
	});
});
