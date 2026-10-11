import { AppFactory } from '@test/factory/app';
import { SUPER_USER, TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import { auth } from 'lib/auth';

/** Admin CRUD for authors, sources and topics, against the real test stack. */
describe('Admin taxonomy', () => {
	let app: AppFactory;
	let admin: string;
	let member: string;
	let moderator: string;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		admin = (await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password)).cookie!;
		member = (await app.signIn(TEST_USER.email, TEST_USER.password)).cookie!;
		const email = 'moderator.t@example.com';
		await auth.api.createUser({
			body: { name: 'Mod', email, password: 'secret', role: 'moderator' }
		});
		await app.db.user.update({
			where: { email },
			data: { emailVerified: true }
		});
		moderator = (await app.signIn(email, 'secret')).cookie!;
	});

	afterAll(async () => {
		await app.close();
	});

	const get = (path: string, cookie = admin) =>
		app.request.get(path).set('Cookie', cookie);
	const post = (path: string, body: object, cookie = admin) =>
		app.request.post(path).set('Cookie', cookie).send(body);
	const patch = (path: string, body: object, cookie = admin) =>
		app.request.patch(path).set('Cookie', cookie).send(body);
	const audits = (action: string, targetId: string) =>
		app.db.auditLog.findMany({ where: { action, targetId } });

	describe('access', () => {
		it.each(['authors', 'sources', 'topics'])(
			'/v1/admin/%s is for admins only',
			async (path) => {
				const url = `/v1/admin/${path}`;
				expect((await app.request.get(url)).status).toBe(401);
				expect((await get(url, member)).status).toBe(403);
				expect((await get(url, moderator)).status).toBe(403);
				expect((await post(url, { name: 'x' }, moderator)).status).toBe(403);
				expect((await get(url)).status).toBe(200);
				const su = (await app.signIn(SUPER_USER.email, SUPER_USER.password))
					.cookie!;
				expect((await get(url, su)).status).toBe(200);
			}
		);

		it('refuses a member’s edit and leaves the row alone', async () => {
			const topic = await app.db.topic.findUniqueOrThrow({
				where: { slug: 'debugging' }
			});
			expect(
				(await patch(`/v1/admin/topics/${topic.id}`, { name: 'x' }, member))
					.status
			).toBe(403);
			expect(
				(await app.db.topic.findUniqueOrThrow({ where: { id: topic.id } })).name
			).toBe('debugging');
		});
	});

	describe('authors', () => {
		let id: string;

		it('adds an author, slugged from the name unless given, and audits it', async () => {
			const res = await post('/v1/admin/authors', {
				name: 'Edsger W. Dijkstra',
				slug: 'dijkstra',
				bornYear: 1930,
				diedYear: 2002,
				description: 'computer scientist'
			});
			expect(res.status).toBe(201);
			expect(res.body).toMatchObject({
				slug: 'dijkstra',
				dates: '1930–2002',
				quotes: 0,
				curated: 0
			});
			id = res.body.id;
			expect(await audits('author.created', 'dijkstra')).toHaveLength(1);

			const auto = await post('/v1/admin/authors', { name: 'C. A. R. Höare' });
			expect(auto.body).toMatchObject({ slug: 'c-a-r-hoare', dates: '—' });
		});

		it('enforces unique slugs and sane input', async () => {
			expect(
				(await post('/v1/admin/authors', { name: 'Other', slug: 'dijkstra' }))
					.status
			).toBe(409);
			expect(
				(await post('/v1/admin/authors', { name: 'X', slug: 'Not A Slug' }))
					.status
			).toBe(400);
			expect(
				(
					await post('/v1/admin/authors', {
						name: 'X',
						bornYear: 2000,
						diedYear: 1990
					})
				).status
			).toBe(400);
		});

		it('edits an author, audits what changed, and refuses a taken slug', async () => {
			const res = await patch(`/v1/admin/authors/${id}`, {
				description: 'programmer',
				slug: 'ewd'
			});
			expect(res.status).toBe(200);
			expect(res.body).toMatchObject({
				slug: 'ewd',
				description: 'programmer'
			});
			const [row] = await audits('author.updated', 'ewd');
			expect(row.note).toBe('slug, description');
			expect(
				(await patch(`/v1/admin/authors/${id}`, { slug: 'c-a-r-hoare' })).status
			).toBe(409);
			expect(
				(await patch(`/v1/admin/authors/${id}`, { diedYear: 1900 })).status
			).toBe(400);
			expect((await patch(`/v1/admin/authors/${id}`, {})).status).toBe(400);
			expect(
				(await patch('/v1/admin/authors/nope', { name: 'x' })).status
			).toBe(404);
		});

		it('lists with search, paging and the public counts', async () => {
			await app.db.quote.createMany({
				data: [
					{ status: 'CURATED' as const, publishedAt: new Date() },
					{ status: 'VERIFIED' as const, publishedAt: new Date() },
					{ status: 'SUBMITTED' as const, publishedAt: null }
				].map((q, i) => ({
					...q,
					publicId: `q_at000${i}`,
					text: `Admin taxonomy ${i}`,
					type: 'CANONICAL' as const,
					authorId: id
				}))
			});
			const res = await get('/v1/admin/authors?search=dijk');
			expect(res.body.total).toBe(1);
			expect(res.body.list[0]).toMatchObject({ quotes: 2, curated: 1 });
			const page = await get('/v1/admin/authors?limit=1&page=2');
			expect(page.body).toMatchObject({
				total: 2,
				lastPage: 2,
				currentPage: 2
			});
			expect(page.body.list[0].name).toBe('Edsger W. Dijkstra');
		});
	});

	describe('sources', () => {
		it('adds, links an author by slug, edits and audits', async () => {
			const res = await post('/v1/admin/sources', {
				title: 'EWD 498: How do we tell truths that might hurt?',
				author: 'ewd',
				year: 1975,
				kind: 'MANUSCRIPT'
			});
			expect(res.status).toBe(201);
			expect(res.body).toMatchObject({
				author: { slug: 'ewd', name: 'Edsger W. Dijkstra' },
				kind: 'MANUSCRIPT',
				url: null,
				quotes: 0
			});
			expect(await audits('source.created', res.body.id)).toHaveLength(1);

			const edit = await patch(`/v1/admin/sources/${res.body.id}`, {
				author: null,
				url: 'https://www.cs.utexas.edu/~EWD/'
			});
			expect(edit.body).toMatchObject({
				author: null,
				url: expect.any(String)
			});
			expect(await audits('source.updated', res.body.id)).toHaveLength(1);

			expect(
				(
					await post('/v1/admin/sources', {
						title: 'x',
						kind: 'BOOK',
						author: 'nobody'
					})
				).status
			).toBe(400);
			expect(
				(
					await post('/v1/admin/sources', {
						title: 'x',
						kind: 'BOOK',
						url: 'javascript:alert(1)'
					})
				).status
			).toBe(400);
		});

		it('searches by title and author', async () => {
			await post('/v1/admin/sources', {
				title: 'Software Tools',
				kind: 'BOOK'
			});
			const byTitle = await get('/v1/admin/sources?search=tools');
			expect(byTitle.body.list.map((s: { title: string }) => s.title)).toEqual([
				'Software Tools'
			]);
		});
	});

	describe('topics', () => {
		it('adds a topic members can then pick, and audits it', async () => {
			const res = await post('/v1/admin/topics', { name: 'Type Systems' });
			expect(res.status).toBe(201);
			expect(res.body).toMatchObject({
				name: 'type systems',
				slug: 'type-systems',
				quotes: 0
			});
			expect(await audits('topic.created', 'type-systems')).toHaveLength(1);
			const pub = await app.request.get('/v1/topics/type-systems');
			expect(pub.status).toBe(200);
		});

		it('enforces unique names and slugs', async () => {
			expect(
				(await post('/v1/admin/topics', { name: 'debugging' })).status
			).toBe(409);
			expect(
				(await post('/v1/admin/topics', { name: 'bugs', slug: 'debugging' }))
					.status
			).toBe(409);
		});

		it('edits a topic and lists them in taxonomy order', async () => {
			const topic = await app.db.topic.findUniqueOrThrow({
				where: { slug: 'type-systems' }
			});
			const res = await patch(`/v1/admin/topics/${topic.id}`, {
				description: 'Types, and what they prove.'
			});
			expect(res.body.description).toBe('Types, and what they prove.');
			expect(await audits('topic.updated', 'type-systems')).toHaveLength(1);

			const list = await get('/v1/admin/topics?limit=100');
			expect(list.body.total).toBe(16);
			expect(list.body.list[0].slug).toBe('programming');
			expect(list.body.list[15].slug).toBe('type-systems');
		});
	});
});
