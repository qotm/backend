import { AppFactory } from '@test/factory/app';
import { TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import type { QuoteStatus, QuoteType } from '@qotm/db/enums';

/** The public quote reads against the real test database. */
describe('Quotes (public)', () => {
	let app: AppFactory;
	let userCookie: string;
	let adminCookie: string;
	let userId: string;
	let adminId: string;

	const day = (n: number) => new Date(Date.UTC(2026, 8, n));

	async function quote(
		publicId: string,
		status: QuoteStatus,
		options: {
			type?: QuoteType;
			publishedAt?: Date | null;
			author?: string;
			topics?: string[];
			contributorId?: string;
		} = {}
	) {
		const topics = await app.db.topic.findMany({
			where: { slug: { in: options.topics ?? ['programming'] } }
		});
		const author = options.author
			? await app.db.author.findUniqueOrThrow({
					where: { slug: options.author }
				})
			: null;
		return app.db.quote.create({
			data: {
				publicId,
				text: `Quote ${publicId}`,
				type: options.type ?? 'CANONICAL',
				status,
				publishedAt: options.publishedAt ?? null,
				authorId: author?.id ?? null,
				contributorId: options.contributorId ?? userId,
				topics: { create: topics.map((t) => ({ topicId: t.id })) },
				events: {
					create: [
						{ toStatus: 'SUBMITTED', at: day(1) },
						{ fromStatus: 'SUBMITTED', toStatus: status, at: day(2) }
					]
				}
			}
		});
	}

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		userCookie = (await app.signIn(TEST_USER.email, TEST_USER.password))
			.cookie!;
		adminCookie = (await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password))
			.cookie!;
		userId = (
			await app.db.user.findUniqueOrThrow({ where: { email: TEST_USER.email } })
		).id;
		adminId = (
			await app.db.user.findUniqueOrThrow({
				where: { email: TEST_ADMIN.email }
			})
		).id;

		await app.db.author.createMany({
			data: [
				{ slug: 'dijkstra', name: 'Edsger W. Dijkstra' },
				{ slug: 'knuth', name: 'Donald E. Knuth' }
			]
		});

		// In feeds: public and past their first check, newest first q_feed05..01.
		await quote('q_feed01', 'VERIFIED', {
			publishedAt: day(1),
			author: 'dijkstra',
			topics: ['debugging']
		});
		await quote('q_feed02', 'CURATED', {
			publishedAt: day(2),
			author: 'dijkstra',
			topics: ['simplicity']
		});
		await quote('q_feed03', 'PUBLISHED', {
			type: 'ORIGINAL',
			publishedAt: day(3),
			contributorId: adminId
		});
		await quote('q_feed04', 'DATASET_RELEASE', {
			publishedAt: day(4),
			author: 'knuth',
			topics: ['debugging']
		});
		await quote('q_feed05', 'DISPUTED', {
			publishedAt: day(5),
			author: 'dijkstra',
			topics: ['debugging']
		});
		// Public on its page, but not yet in feeds (no first check passed).
		await quote('q_review', 'UNDER_REVIEW', {
			author: 'dijkstra',
			topics: ['debugging']
		});
		// Never public.
		await quote('q_privat', 'PRIVATE', { type: 'PRIVATE' });
		await quote('q_submit', 'SUBMITTED');
		await quote('q_origck', 'ORIGINALITY_CHECK', { type: 'ORIGINAL' });
		await quote('q_reject', 'REJECTED', { publishedAt: day(6) });
		await quote('q_withdr', 'WITHDRAWN', {
			publishedAt: day(7),
			author: 'dijkstra'
		});

		// Releases: the current one holds q_feed04 and q_feed02; an older one
		// held q_feed01; a preview holds q_feed03.
		const q = async (id: string) =>
			(await app.db.quote.findUniqueOrThrow({ where: { publicId: id } })).id;
		const release = (
			version: string,
			state: 'PUBLISHED' | 'PREVIEW',
			at: Date | null,
			ids: string[]
		) =>
			Promise.all(ids.map(q)).then((quoteIds) =>
				app.db.release.create({
					data: {
						version,
						state,
						schemaVersion: 1,
						publishedAt: at,
						quotes: {
							create: quoteIds.map((quoteId) => ({
								quoteId,
								textAtRelease: 'x'
							}))
						}
					}
				})
			);
		await release('v2026.08.1', 'PUBLISHED', day(1), ['q_feed01']);
		await release('v2026.08.2', 'PUBLISHED', day(5), ['q_feed04', 'q_feed02']);
		await release('v2026.09.1', 'PREVIEW', null, ['q_feed03']);

		await app.db.like.create({
			data: { userId, quoteId: await q('q_feed01') }
		});
		await app.db.quote.update({
			where: { publicId: 'q_feed01' },
			data: { likeCount: 1 }
		});
	});

	afterAll(async () => {
		await app.close();
	});

	const ids = (body: { list: { id: string }[] }) => body.list.map((q) => q.id);

	async function walk(query: Record<string, string | number>) {
		const seen: string[] = [];
		let cursor: string | null = null;
		do {
			const res = await app.request
				.get('/v1/quotes')
				.query({ ...query, limit: 2, ...(cursor ? { cursor } : {}) });
			expect(res.status).toBe(200);
			seen.push(...ids(res.body));
			cursor = res.body.nextCursor;
		} while (cursor);
		return seen;
	}

	describe('GET /v1/quotes', () => {
		it('latest: only public, checked quotes, newest first', async () => {
			const res = await app.request.get('/v1/quotes').query({ feed: 'latest' });
			expect(res.status).toBe(200);
			expect(ids(res.body)).toEqual([
				'q_feed05',
				'q_feed04',
				'q_feed03',
				'q_feed02',
				'q_feed01'
			]);
			expect(res.body.nextCursor).toBeNull();
		});

		it('pages with a cursor, without gaps or repeats', async () => {
			expect(await walk({ feed: 'latest' })).toEqual([
				'q_feed05',
				'q_feed04',
				'q_feed03',
				'q_feed02',
				'q_feed01'
			]);
		});

		it('curated: the current published release only', async () => {
			const res = await app.request
				.get('/v1/quotes')
				.query({ feed: 'curated' });
			expect(ids(res.body)).toEqual(['q_feed04', 'q_feed02']);
		});

		it('discover: the same eligible quotes, in an order stable between requests', async () => {
			const first = await walk({ feed: 'discover' });
			const again = await walk({ feed: 'discover' });
			expect([...first].sort()).toEqual([
				'q_feed01',
				'q_feed02',
				'q_feed03',
				'q_feed04',
				'q_feed05'
			]);
			expect(again).toEqual(first);
		});

		it.each(['latest', 'discover'])(
			'%s filters by topic, author, contributor and type',
			async (feed) => {
				const get = async (query: Record<string, string>) =>
					ids(
						(await app.request.get('/v1/quotes').query({ feed, ...query })).body
					).sort();
				expect(await get({ topic: 'debugging' })).toEqual([
					'q_feed01',
					'q_feed04',
					'q_feed05'
				]);
				expect(await get({ author: 'dijkstra' })).toEqual([
					'q_feed01',
					'q_feed02',
					'q_feed05'
				]);
				expect(await get({ contributor: 'test_admin' })).toEqual(['q_feed03']);
				expect(await get({ type: 'original' })).toEqual(['q_feed03']);
			}
		);

		it('carries viewer state only when signed in', async () => {
			const anonymous = await app.request.get('/v1/quotes');
			expect(anonymous.body.list[0]).not.toHaveProperty('viewer');

			const signedIn = await app.request
				.get('/v1/quotes')
				.set('Cookie', userCookie);
			const feed01 = signedIn.body.list.find(
				(q: { id: string }) => q.id === 'q_feed01'
			);
			expect(feed01.viewer).toEqual({
				liked: true,
				favorited: false,
				recommended: false
			});
			expect(feed01.counts.likes).toBe(1);
		});

		it('rejects an unknown feed or a malformed cursor', async () => {
			expect(
				(await app.request.get('/v1/quotes').query({ feed: 'popular' })).status
			).toBe(400);
			expect(
				(await app.request.get('/v1/quotes').query({ cursor: 'nope' })).status
			).toBe(400);
		});
	});

	describe('GET /v1/quotes/:id', () => {
		it('returns provenance, the dated lifecycle and published releases', async () => {
			const res = await app.request.get('/v1/quotes/q_feed01');
			expect(res.status).toBe(200);
			expect(res.body).toMatchObject({
				id: 'q_feed01',
				type: 'canonical',
				status: 'VERIFIED',
				author: { slug: 'dijkstra', name: 'Edsger W. Dijkstra' },
				topics: [{ slug: 'debugging', name: 'debugging' }],
				lifecycle: [
					{ status: 'SUBMITTED', at: day(1).toISOString() },
					{ status: 'VERIFIED', at: day(2).toISOString() }
				],
				releases: ['v2026.08.1']
			});
			expect(res.body).not.toHaveProperty('viewer');
		});

		it('leaves preview releases out of provenance', async () => {
			const res = await app.request.get('/v1/quotes/q_feed03');
			expect(res.body.releases).toEqual([]);
		});

		it('shows a quote under review on its page', async () => {
			expect((await app.request.get('/v1/quotes/q_review')).status).toBe(200);
		});

		it.each(['q_privat', 'q_submit', 'q_origck'])(
			'hides %s from everyone but its contributor',
			async (id) => {
				expect((await app.request.get(`/v1/quotes/${id}`)).status).toBe(404);
				expect(
					(await app.request.get(`/v1/quotes/${id}`).set('Cookie', adminCookie))
						.status
				).toBe(404);
				const own = await app.request
					.get(`/v1/quotes/${id}`)
					.set('Cookie', userCookie);
				expect(own.status).toBe(200);
				expect(own.body.viewer).toBeDefined();
			}
		);

		it('404s a rejected quote for everyone but its contributor', async () => {
			expect((await app.request.get('/v1/quotes/q_reject')).status).toBe(404);
			expect(
				(
					await app.request
						.get('/v1/quotes/q_reject')
						.set('Cookie', adminCookie)
				).status
			).toBe(404);
			// The contributor still reads it, with the reviewer's note (my quotes).
			expect(
				(await app.request.get('/v1/quotes/q_reject').set('Cookie', userCookie))
					.status
			).toBe(200);
		});

		it('404s a withdrawn quote with its id kept, even for its contributor', async () => {
			for (const cookie of [undefined, userCookie]) {
				const req = app.request.get('/v1/quotes/q_withdr');
				const res = cookie ? await req.set('Cookie', cookie) : await req;
				expect(res.status).toBe(404);
				expect(res.body.message).toContain('q_withdr');
			}
		});

		it('404s an unknown or malformed id', async () => {
			expect((await app.request.get('/v1/quotes/q_zzzzzz')).status).toBe(404);
			expect((await app.request.get('/v1/quotes/not-an-id')).status).toBe(404);
		});
	});

	describe('GET /v1/quotes/:id/related', () => {
		it('puts the same author first, then shared topics, and never the quote itself', async () => {
			const res = await app.request.get('/v1/quotes/q_feed01/related');
			expect(res.status).toBe(200);
			// Same author (dijkstra): q_feed05 (shares debugging), q_feed02; then
			// q_feed04 by topic. q_review and q_withdr never appear.
			expect(ids(res.body)).toEqual(['q_feed05', 'q_feed02', 'q_feed04']);
		});

		it('404s for a quote the viewer cannot see', async () => {
			expect(
				(await app.request.get('/v1/quotes/q_privat/related')).status
			).toBe(404);
		});
	});
});
