import { AppFactory } from '@test/factory/app';
import { TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import type { QuoteStatus, QuoteType } from '@qotm/db/enums';

/** Like, favorite and recommend endpoints, and favorites sync, against the real test stack. */
describe('Reactions API', () => {
	let app: AppFactory;
	let cookie: string;
	let otherId: string;

	let n = 0;
	async function quote(
		status: QuoteStatus,
		type: QuoteType = 'CANONICAL',
		extra: {
			text?: string;
			authorName?: string;
			likeCount?: number;
			contributorId?: string;
		} = {}
	) {
		const publicId = `q_ra${String(++n).padStart(4, '0')}`;
		const author = extra.authorName
			? await app.db.author.create({
					data: { slug: `author-${n}`, name: extra.authorName }
				})
			: null;
		return app.db.quote.create({
			data: {
				publicId,
				type,
				status,
				text: extra.text ?? `Reaction quote ${publicId}`,
				publishedAt: new Date(),
				likeCount: extra.likeCount ?? 0,
				authorId: author?.id ?? null,
				contributorId: extra.contributorId ?? null
			}
		});
	}

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		cookie = (await app.signIn(TEST_USER.email, TEST_USER.password)).cookie!;
		otherId = (
			await app.db.user.findUniqueOrThrow({
				where: { email: TEST_ADMIN.email }
			})
		).id;
	});

	afterAll(async () => {
		await app.close();
	});

	const post = (path: string) => app.request.post(path).set('Cookie', cookie);
	const del = (path: string) => app.request.delete(path).set('Cookie', cookie);

	it('needs a session', async () => {
		const q = await quote('VERIFIED');
		expect(
			(await app.request.post(`/v1/quotes/${q.publicId}/like`)).status
		).toBe(401);
	});

	it.each(['like', 'favorite'])('toggles a %s idempotently', async (kind) => {
		const q = await quote('VERIFIED');
		const url = `/v1/quotes/${q.publicId}/${kind}`;
		expect((await post(url)).body).toEqual({ active: true, count: 1 });
		expect((await post(url)).body).toEqual({ active: true, count: 1 });
		expect((await del(url)).body).toEqual({ active: false, count: 0 });
		expect((await del(url)).body).toEqual({ active: false, count: 0 });
	});

	describe('recommendations', () => {
		it('are refused on a canonical quote with a 400', async () => {
			const q = await quote('VERIFIED');
			expect(
				(await post(`/v1/quotes/${q.publicId}/recommendation`)).status
			).toBe(400);
		});

		it('count on a community original', async () => {
			const q = await quote('PUBLISHED', 'ORIGINAL');
			expect(
				(await post(`/v1/quotes/${q.publicId}/recommendation`)).body
			).toEqual({
				active: true,
				count: 1
			});
		});

		it('stop once the original is curated, but can still be withdrawn', async () => {
			const q = await quote('PUBLISHED', 'ORIGINAL');
			await post(`/v1/quotes/${q.publicId}/recommendation`);
			await app.db.quote.update({
				where: { id: q.id },
				data: { status: 'CURATED' }
			});
			expect(
				(await post(`/v1/quotes/${q.publicId}/recommendation`)).status
			).toBe(409);
			expect(
				(await del(`/v1/quotes/${q.publicId}/recommendation`)).body
			).toEqual({
				active: false,
				count: 0
			});
		});
	});

	it('404s a quote the member cannot see', async () => {
		const q = await quote('PRIVATE', 'PRIVATE', { contributorId: otherId });
		expect((await post(`/v1/quotes/${q.publicId}/favorite`)).status).toBe(404);
		expect((await post('/v1/quotes/q_zzzzzz/like')).status).toBe(404);
	});

	describe('GET /v1/me/favorites', () => {
		let a: { publicId: string };
		let b: { publicId: string };
		let c: { publicId: string };

		beforeAll(async () => {
			await app.db.favorite.deleteMany({});
			a = await quote('CURATED', 'CANONICAL', {
				authorName: 'Edsger W. Dijkstra',
				likeCount: 5,
				text: 'Simplicity is prerequisite for reliability.'
			});
			b = await quote('CURATED', 'CANONICAL', {
				authorName: 'Brian W. Kernighan',
				likeCount: 50
			});
			c = await quote('PUBLISHED', 'ORIGINAL', { likeCount: 20 });
			for (const q of [a, b, c])
				await post(`/v1/quotes/${q.publicId}/favorite`);
		});

		const ids = (body: { list: { id: string }[] }) =>
			body.list.map((q) => q.id);
		const list = (query: Record<string, string> = {}) =>
			app.request.get('/v1/me/favorites').query(query).set('Cookie', cookie);

		it('lists most recently saved first, with the total and viewer state', async () => {
			const res = await list();
			expect(res.body.total).toBe(3);
			expect(ids(res.body)).toEqual([c.publicId, b.publicId, a.publicId]);
			expect(res.body.list[0]).toMatchObject({
				savedAt: expect.any(String),
				viewer: { favorited: true }
			});
		});

		it('sorts by author A–Z (originals last) and by most liked', async () => {
			expect(ids((await list({ sort: 'author' })).body)).toEqual([
				b.publicId,
				a.publicId,
				c.publicId
			]);
			expect(ids((await list({ sort: 'likes' })).body)).toEqual([
				b.publicId,
				c.publicId,
				a.publicId
			]);
		});

		it('filters by text and author', async () => {
			expect(ids((await list({ q: 'reliability' })).body)).toEqual([
				a.publicId
			]);
			expect(ids((await list({ q: 'kernighan' })).body)).toEqual([b.publicId]);
		});

		it('drops a quote withdrawn since, which can still be removed', async () => {
			await app.db.quote.updateMany({
				where: { publicId: a.publicId },
				data: { status: 'WITHDRAWN' }
			});
			expect(ids((await list()).body)).not.toContain(a.publicId);
			expect((await del(`/v1/quotes/${a.publicId}/favorite`)).body.active).toBe(
				false
			);
		});
	});

	describe('favorites sync (CLI)', () => {
		it('applies offline adds and removes, skips unknown or hidden ids, and replays safely', async () => {
			await app.db.favorite.deleteMany({});
			const keep = await quote('CURATED');
			const drop = await quote('CURATED');
			const hidden = await quote('PRIVATE', 'PRIVATE', {
				contributorId: otherId
			});
			await post(`/v1/quotes/${drop.publicId}/favorite`);

			const changes = {
				add: [keep.publicId, hidden.publicId, 'q_zzzzzz'],
				remove: [drop.publicId]
			};
			const put = () =>
				app.request
					.put('/v1/me/favorites/sync')
					.set('Cookie', cookie)
					.send(changes);

			const first = await put();
			expect(first.status).toBe(200);
			expect(first.body.favorites.map((f: { id: string }) => f.id)).toEqual([
				keep.publicId
			]);
			expect(first.body.skipped.sort()).toEqual(
				[hidden.publicId, 'q_zzzzzz'].sort()
			);

			const again = await put();
			expect(again.body.favorites.map((f: { id: string }) => f.id)).toEqual([
				keep.publicId
			]);
			const state = await app.request
				.get('/v1/me/favorites/sync')
				.set('Cookie', cookie);
			expect(state.body).toMatchObject({
				favorites: [{ id: keep.publicId }],
				skipped: []
			});
			expect(
				(await app.db.quote.findUniqueOrThrow({ where: { id: keep.id } }))
					.favoriteCount
			).toBe(1);
		});

		it('rejects malformed ids', async () => {
			const res = await app.request
				.put('/v1/me/favorites/sync')
				.set('Cookie', cookie)
				.send({ add: ['not-an-id'] });
			expect(res.status).toBe(400);
		});
	});
});
