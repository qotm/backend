import { AppFactory } from '@test/factory/app';
import { TEST_USER } from '@test/factory/constants';
import type { QuoteStatus, QuoteType } from '@qotm/db/enums';

/** GET /v1/search, against the real test stack. */
describe('Search', () => {
	let app: AppFactory;
	let userId: string;
	let cookie: string;

	let n = 0;
	async function quote(
		text: string,
		status: QuoteStatus = 'CURATED',
		extra: {
			authorId?: string;
			type?: QuoteType;
			contributorId?: string;
			topics?: string[];
		} = {}
	) {
		const topics = await app.db.topic.findMany({
			where: { slug: { in: extra.topics ?? [] } },
			select: { id: true }
		});
		return app.db.quote.create({
			data: {
				publicId: `q_se${String(++n).padStart(4, '0')}`,
				text,
				type: extra.type ?? 'CANONICAL',
				status,
				authorId: extra.authorId ?? null,
				contributorId: extra.contributorId ?? null,
				// Quotes still being checked have no publishedAt yet.
				publishedAt:
					status === 'NEEDS_EVIDENCE' ? null : new Date(Date.UTC(2026, 8, n)),
				topics: { create: topics.map((t) => ({ topicId: t.id })) }
			}
		});
	}

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		cookie = (await app.signIn(TEST_USER.email, TEST_USER.password)).cookie!;
		userId = (
			await app.db.user.findUniqueOrThrow({ where: { email: TEST_USER.email } })
		).id;

		const dijkstra = await app.db.author.create({
			data: {
				slug: 'dijkstra',
				name: 'Edsger W. Dijkstra',
				bornYear: 1930,
				diedYear: 2002,
				description: 'computer scientist'
			}
		});
		const kernighan = await app.db.author.create({
			data: { slug: 'kernighan', name: 'Brian W. Kernighan & P. J. Plauger' }
		});
		await app.db.author.create({
			data: { slug: 'hoare', name: 'C. A. R. Hoare' }
		});

		await quote(
			'Controlling complexity is the essence of computer programming.',
			'CURATED',
			{ authorId: kernighan.id, topics: ['complexity', 'programming'] }
		);
		await quote('Simplicity is prerequisite for reliability.', 'VERIFIED', {
			authorId: dijkstra.id,
			topics: ['simplicity']
		});
		await quote(
			'Program testing can be used to show the presence of bugs, but never to show their absence!',
			'NEEDS_EVIDENCE',
			{ authorId: dijkstra.id, topics: ['debugging'] }
		);
		await quote('Complex systems fail in complex ways.', 'PUBLISHED', {
			type: 'ORIGINAL',
			contributorId: userId
		});
		// Never in results, not even for their owner.
		await quote('My private complexity notes.', 'PRIVATE', {
			type: 'PRIVATE',
			contributorId: userId
		});
		await quote('Unchecked complexity submission.', 'SUBMITTED', {
			contributorId: userId
		});
		await quote('Withdrawn complexity remark.', 'WITHDRAWN');
		await quote('Rejected complexity remark.', 'REJECTED');
	});

	afterAll(async () => {
		await app.close();
	});

	const search = (query: Record<string, string | number>, as?: string) => {
		const req = app.request.get('/v1/search').query(query);
		return as ? req.set('Cookie', as) : req;
	};
	const texts = (body: { quotes: { text: string }[] }) =>
		body.quotes.map((q) => q.text);

	it('is public, and needs a query', async () => {
		expect((await search({ q: 'complexity' })).status).toBe(200);
		expect((await search({ q: '' })).status).toBe(400);
		expect((await search({ q: 'x', type: 'people' })).status).toBe(400);
	});

	it('finds public quotes by their words, stemmed, with counts per type', async () => {
		const res = await search({ q: 'complexity' });
		expect(res.body.counts).toEqual({ quotes: 2, authors: 0, topics: 1 });
		expect(texts(res.body).sort()).toEqual([
			'Complex systems fail in complex ways.',
			'Controlling complexity is the essence of computer programming.'
		]);
		expect(res.body).toMatchObject({
			type: 'quotes',
			total: 2,
			currentPage: 1,
			lastPage: 1,
			authors: [],
			topics: []
		});
	});

	it('never returns a private, unchecked, rejected or withdrawn quote, even to its owner', async () => {
		const res = await search({ q: 'complexity' }, cookie);
		expect(texts(res.body).join(' ')).not.toMatch(
			/private|Unchecked|Withdrawn|Rejected/
		);
		expect(res.body.counts.quotes).toBe(2);
	});

	it('adds the viewer’s own state when signed in', async () => {
		const anon = await search({ q: 'reliability' });
		expect(anon.body.quotes[0].viewer).toBeUndefined();
		const res = await search({ q: 'reliability' }, cookie);
		expect(res.body.quotes[0].viewer).toEqual({
			liked: false,
			favorited: false,
			recommended: false
		});
	});

	it('finds an author despite a typo ("djikstra"), and their quotes', async () => {
		const res = await search({ q: 'djikstra', type: 'authors' });
		expect(res.body.counts).toMatchObject({ authors: 1, quotes: 2 });
		expect(res.body.authors).toEqual([
			{
				slug: 'dijkstra',
				name: 'Edsger W. Dijkstra',
				line: '1930–2002 · computer scientist',
				quotes: 1
			}
		]);
		expect(res.body.quotes).toEqual([]);
	});

	it('matches part of a name', async () => {
		const res = await search({ q: 'kernig', type: 'authors' });
		expect(res.body.authors.map((a: { slug: string }) => a.slug)).toEqual([
			'kernighan'
		]);
	});

	it('lists topics with their feed counts', async () => {
		const res = await search({ q: 'complexity', type: 'topics' });
		expect(res.body.topics).toEqual([
			{
				slug: 'complexity',
				name: 'complexity',
				description: null,
				counts: { quotes: 1, curated: 1 }
			}
		]);
	});

	it('returns counts of 0 when nothing matches', async () => {
		for (const type of ['quotes', 'authors', 'topics']) {
			const res = await search({ q: 'zzqxv', type });
			expect(res.status).toBe(200);
			expect(res.body).toMatchObject({
				counts: { quotes: 0, authors: 0, topics: 0 },
				total: 0,
				lastPage: 1,
				quotes: [],
				authors: [],
				topics: []
			});
		}
	});

	it('treats LIKE wildcards in the query as text', async () => {
		const res = await search({ q: '%', type: 'authors' });
		expect(res.body.counts.authors).toBe(0);
	});

	it('pages the requested type', async () => {
		const first = await search({ q: 'complexity', limit: 1 });
		const second = await search({ q: 'complexity', limit: 1, page: 2 });
		expect(first.body).toMatchObject({ total: 2, lastPage: 2 });
		expect(first.body.quotes).toHaveLength(1);
		expect(second.body.quotes).toHaveLength(1);
		expect(second.body.quotes[0].id).not.toBe(first.body.quotes[0].id);
	});
});
