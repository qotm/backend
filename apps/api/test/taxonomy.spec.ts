import { AppFactory } from '@test/factory/app';
import type { QuoteStatus } from '@qotm/db/enums';

/** Public topic and author reads, and the feed's tab filter, against the real test stack. */
describe('Topics and authors', () => {
	let app: AppFactory;

	let n = 0;
	async function quote(
		status: QuoteStatus,
		authorId: string | null,
		topics: string[],
		published = true
	) {
		const ids = await app.db.topic.findMany({
			where: { slug: { in: topics } },
			select: { id: true }
		});
		return app.db.quote.create({
			data: {
				publicId: `q_tx${String(++n).padStart(4, '0')}`,
				text: `Taxonomy quote ${n}`,
				type: 'CANONICAL',
				status,
				authorId,
				publishedAt: published ? new Date(Date.UTC(2026, 8, n)) : null,
				topics: { create: ids.map((t) => ({ topicId: t.id })) }
			}
		});
	}

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		const dijkstra = await app.db.author.create({
			data: {
				slug: 'dijkstra',
				name: 'Edsger W. Dijkstra',
				bornYear: 1930,
				diedYear: 2002,
				description: 'computer scientist',
				wikidataId: 'Q8556'
			}
		});
		await app.db.author.create({
			data: { slug: 'kernighan', name: 'Brian W. Kernighan', bornYear: 1942 }
		});
		await app.db.author.create({
			data: {
				slug: 'abelson-sussman',
				name: 'Harold Abelson & Gerald Jay Sussman'
			}
		});

		await quote('CURATED', dijkstra.id, ['debugging', 'simplicity']);
		await quote('DATASET_RELEASE', dijkstra.id, ['debugging']);
		await quote('VERIFIED', dijkstra.id, ['debugging', 'programming']);
		await quote('UNDER_REVIEW', dijkstra.id, ['programming'], false);
		await quote('NEEDS_EVIDENCE', dijkstra.id, ['debugging'], false);
		await quote('SUBMITTED', dijkstra.id, ['debugging'], false); // not public
		await quote('WITHDRAWN', dijkstra.id, ['debugging']); // not public
	});

	afterAll(async () => {
		await app.close();
	});

	describe('GET /v1/topics', () => {
		it('lists the 15 topics in taxonomy order, publicly, with feed counts', async () => {
			const res = await app.request.get('/v1/topics');
			expect(res.status).toBe(200);
			expect(res.body.list).toHaveLength(15);
			expect(res.body.list[0].slug).toBe('programming');
			const debugging = res.body.list.find(
				(t: { slug: string }) => t.slug === 'debugging'
			);
			expect(debugging.counts).toEqual({ quotes: 3, curated: 2 });
		});

		it('returns one topic, or 404', async () => {
			const res = await app.request.get('/v1/topics/simplicity');
			expect(res.body).toMatchObject({
				slug: 'simplicity',
				name: 'simplicity',
				counts: { quotes: 1, curated: 1 }
			});
			expect((await app.request.get('/v1/topics/astrology')).status).toBe(404);
		});

		it('counts what the topic feed lists', async () => {
			const topic = (await app.request.get('/v1/topics/debugging')).body;
			const feed = await app.request
				.get('/v1/quotes')
				.query({ topic: 'debugging', limit: 50 });
			expect(feed.body.list).toHaveLength(topic.counts.quotes);
			const curated = await app.request
				.get('/v1/quotes')
				.query({ topic: 'debugging', state: 'curated', limit: 50 });
			expect(curated.body.list).toHaveLength(topic.counts.curated);
		});
	});

	describe('GET /v1/authors/:slug', () => {
		it('returns the lifespan line, top topics and tab counts', async () => {
			const res = await app.request.get('/v1/authors/dijkstra');
			expect(res.status).toBe(200);
			expect(res.body).toMatchObject({
				name: 'Edsger W. Dijkstra',
				line: '1930–2002 · computer scientist',
				wikidataId: 'Q8556',
				tabs: { all: 3, curated: 2, review: 2 }
			});
			expect(res.body.topics[0]).toEqual({
				slug: 'debugging',
				name: 'debugging'
			});
		});

		it.each([
			['kernighan', '1942–'],
			['abelson-sussman', '—']
		])('writes %s’s line as %s', async (slug, line) => {
			expect((await app.request.get(`/v1/authors/${slug}`)).body.line).toBe(
				line
			);
		});

		it('404s an unknown author', async () => {
			expect((await app.request.get('/v1/authors/nobody')).status).toBe(404);
		});

		it.each(['all', 'curated', 'review'] as const)(
			'counts what the %s tab lists',
			async (state) => {
				const author = (await app.request.get('/v1/authors/dijkstra')).body;
				for (const feed of ['latest', 'discover']) {
					const res = await app.request
						.get('/v1/quotes')
						.query({ author: 'dijkstra', state, feed, limit: 50 });
					expect(res.body.list).toHaveLength(author.tabs[state]);
				}
			}
		);
	});

	describe('the feed’s review tab', () => {
		it('lists public quotes still being checked, never unchecked or withdrawn ones', async () => {
			const res = await app.request
				.get('/v1/quotes')
				.query({ author: 'dijkstra', state: 'review' });
			expect(
				res.body.list.map((q: { status: string }) => q.status).sort()
			).toEqual(['NEEDS_EVIDENCE', 'UNDER_REVIEW']);
		});
	});

	// Last: it adds a disputed quote the counts above would include.
	describe('GET /v1/sitemap', () => {
		it('lists what a search engine may index: no unchecked, disputed or withdrawn quote', async () => {
			const disputed = await quote('DISPUTED', null, ['debugging']);
			const res = await app.request.get('/v1/sitemap');
			expect(res.status).toBe(200);
			expect(res.headers['cache-control']).toBe('public, max-age=600');
			const quotes = await app.db.quote.findMany({
				where: {
					publicId: { in: res.body.quotes.map((q: { id: string }) => q.id) }
				}
			});
			expect(quotes.map((q) => q.status).sort()).toEqual([
				'CURATED',
				'DATASET_RELEASE',
				'VERIFIED'
			]);
			expect(res.body.quotes.map((q: { id: string }) => q.id)).not.toContain(
				disputed.publicId
			);
			expect(res.body.quotes[0].updatedAt).toEqual(
				expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
			);
			// Authors with an indexable quote; topics with one.
			expect(res.body.authors.map((a: { slug: string }) => a.slug)).toEqual([
				'dijkstra'
			]);
			expect(
				res.body.topics.map((t: { slug: string }) => t.slug).sort()
			).toEqual(['debugging', 'programming', 'simplicity']);
		});
	});
});
