import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AppFactory } from '@test/factory/app';
import { TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import { auth } from 'lib/auth';
import { EXPORT_QUOTES, EXPORTS_QUEUE } from 'exports';
import type { QuoteStatus, QuoteType } from '@qotm/db/enums';

/** Admin › Quotes and the export trigger, against the real test stack. */
describe('Admin quotes', () => {
	let app: AppFactory;
	let admin: string;
	let queue: Queue;

	let n = 0;
	async function quote(
		status: QuoteStatus,
		type: QuoteType = 'CANONICAL',
		extra: { text?: string; authorId?: string; contributorId?: string } = {}
	) {
		return app.db.quote.create({
			data: {
				publicId: `q_aq${String(++n).padStart(4, '0')}`,
				text: extra.text ?? `Admin list quote ${n}`,
				type,
				status,
				authorId: extra.authorId ?? null,
				contributorId: extra.contributorId ?? null,
				createdAt: new Date(Date.UTC(2026, 8, n))
			}
		});
	}

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		admin = (await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password)).cookie!;
		queue = app.instance.get(getQueueToken(EXPORTS_QUEUE));

		const member = await app.db.user.findUniqueOrThrow({
			where: { email: TEST_USER.email }
		});
		const dijkstra = await app.db.author.create({
			data: { slug: 'dijkstra', name: 'Edsger W. Dijkstra' }
		});
		const shipped = await quote('DATASET_RELEASE', 'CANONICAL', {
			text: 'Simplicity is prerequisite for reliability.',
			authorId: dijkstra.id
		});
		await quote('CURATED', 'CANONICAL', { authorId: dijkstra.id });
		await quote('VERIFIED');
		await quote('WITHDRAWN');
		await quote('PUBLISHED', 'ORIGINAL', { contributorId: member.id });
		await quote('PRIVATE', 'PRIVATE', { contributorId: member.id }); // never listed
		for (const [version, at] of [
			['v2026.08.1', Date.UTC(2026, 7, 4)],
			['v2026.08.3', Date.UTC(2026, 7, 30)]
		] as const) {
			await app.db.release.create({
				data: {
					version,
					state: 'PUBLISHED',
					schemaVersion: 1,
					publishedAt: new Date(at),
					quotes: {
						create: { quoteId: shipped.id, textAtRelease: shipped.text }
					}
				}
			});
		}
	});

	afterEach(async () => {
		await queue.obliterate({ force: true });
	});

	afterAll(async () => {
		await app.close();
	});

	const list = (query: Record<string, string | number> = {}, cookie = admin) =>
		app.request.get('/v1/admin/quotes').query(query).set('Cookie', cookie);
	const ids = (body: { list: { id: string }[] }) => body.list.map((q) => q.id);

	it('is for admins only', async () => {
		expect((await app.request.get('/v1/admin/quotes')).status).toBe(401);
		const member = (await app.signIn(TEST_USER.email, TEST_USER.password))
			.cookie!;
		const email = 'verifier.aq@example.com';
		await auth.api.createUser({
			body: { name: 'V', email, password: 'secret', role: 'verifier' }
		});
		await app.db.user.update({
			where: { email },
			data: { emailVerified: true }
		});
		const verifier = (await app.signIn(email, 'secret')).cookie!;
		for (const cookie of [member, verifier]) {
			expect((await list({}, cookie)).status).toBe(403);
			expect(
				(
					await app.request
						.post('/v1/admin/quotes/export')
						.set('Cookie', cookie)
						.send({})
				).status
			).toBe(403);
		}
		expect(await queue.count()).toBe(0);
	});

	it('lists every quote but private ones, newest first, with the header counts', async () => {
		const res = await list();
		expect(res.status).toBe(200);
		expect(res.body.counts).toEqual({ public: 4, eligible: 2 });
		expect(ids(res.body)).toEqual([
			'q_aq0005',
			'q_aq0004',
			'q_aq0003',
			'q_aq0002',
			'q_aq0001'
		]);
		expect(res.body.list[4]).toMatchObject({
			text: 'Simplicity is prerequisite for reliability.',
			author: 'Edsger W. Dijkstra',
			type: 'canonical',
			status: 'DATASET_RELEASE',
			lastRelease: 'v2026.08.3'
		});
		expect(res.body.list[0]).toMatchObject({
			type: 'original',
			author: '@test_user',
			lastRelease: null
		});
	});

	it('filters by text, author, id, type and state', async () => {
		expect(ids((await list({ q: 'reliability' })).body)).toEqual(['q_aq0001']);
		expect(ids((await list({ q: 'DIJKSTRA' })).body)).toEqual([
			'q_aq0002',
			'q_aq0001'
		]);
		expect(ids((await list({ q: 'q_aq0003' })).body)).toEqual(['q_aq0003']);
		expect(ids((await list({ type: 'original' })).body)).toEqual(['q_aq0005']);
		expect(ids((await list({ state: 'WITHDRAWN' })).body)).toEqual([
			'q_aq0004'
		]);
		expect((await list({ state: 'PRIVATE' })).status).toBe(400);
	});

	it('pages', async () => {
		const res = await list({ limit: 2, page: 3 });
		expect(res.body).toMatchObject({ total: 5, lastPage: 3, currentPage: 3 });
		expect(ids(res.body)).toEqual(['q_aq0001']);
	});

	it('queues a CSV export of the filters, for the requesting admin', async () => {
		const res = await app.request
			.post('/v1/admin/quotes/export')
			.set('Cookie', admin)
			.send({ q: 'dijkstra', state: 'CURATED' });
		expect(res.status).toBe(202);
		expect(res.body.id).toMatch(/^export-/);
		const job = await queue.getJob(res.body.id);
		expect(job).toMatchObject({
			name: EXPORT_QUOTES,
			data: {
				filters: { q: 'dijkstra', state: 'CURATED' },
				requestedBy: { handle: 'test_admin' }
			},
			opts: { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } }
		});
	});

	describe('bulk actions', () => {
		const post = (path: string, body: object, cookie = admin) =>
			app.request
				.post(`/v1/admin/quotes/bulk/${path}`)
				.set('Cookie', cookie)
				.send(body);

		it('withdraws each quote with the note, a history step and an audit entry, skipping what it cannot', async () => {
			const a = await quote('VERIFIED');
			const b = await quote('DISPUTED');
			const gone = await quote('WITHDRAWN');
			const res = await post('withdraw', {
				ids: [a.publicId, b.publicId, gone.publicId, 'q_nosuch1'],
				note: 'Duplicates of quotes already in the dataset'
			});
			expect(res.status).toBe(200);
			expect(res.body).toEqual({
				done: [a.publicId, b.publicId],
				unchanged: [],
				skipped: [
					{ id: gone.publicId, reason: 'already withdrawn' },
					{ id: 'q_nosuch1', reason: 'not found' }
				]
			});
			for (const q of [a, b]) {
				const row = await app.db.quote.findUniqueOrThrow({
					where: { id: q.id },
					include: { events: { orderBy: { at: 'asc' } } }
				});
				expect(row.status).toBe('WITHDRAWN');
				expect(row.events[row.events.length - 1]).toMatchObject({
					toStatus: 'WITHDRAWN',
					note: 'Duplicates of quotes already in the dataset'
				});
				expect(
					await app.db.auditLog.count({
						where: { action: 'quote.withdrawn', targetId: q.publicId }
					})
				).toBe(1);
			}
			expect(
				(await post('withdraw', { ids: [a.publicId], note: '' })).status
			).toBe(400);
		});

		it('adds a topic where it is missing and takes it off, never a quote’s only one', async () => {
			const [complexity, simplicity] = await Promise.all(
				['complexity', 'simplicity'].map((slug) =>
					app.db.topic.upsert({
						where: { slug },
						update: {},
						create: { slug, name: slug }
					})
				)
			);
			const has = await quote('VERIFIED');
			const lacks = await quote('VERIFIED');
			await app.db.quoteTopic.createMany({
				data: [
					{ quoteId: has.id, topicId: complexity.id },
					{ quoteId: has.id, topicId: simplicity.id },
					{ quoteId: lacks.id, topicId: simplicity.id }
				]
			});
			const added = await post('topic', {
				ids: [has.publicId, lacks.publicId],
				topic: 'complexity',
				action: 'add'
			});
			expect(added.body).toEqual({
				done: [lacks.publicId],
				unchanged: [has.publicId],
				skipped: []
			});
			expect(
				await app.db.auditLog.count({
					where: {
						action: 'quote.topic_added',
						targetId: lacks.publicId,
						note: 'complexity'
					}
				})
			).toBe(1);

			// Removing simplicity: `lacks` now has complexity too, `has` keeps complexity.
			const removed = await post('topic', {
				ids: [has.publicId, lacks.publicId],
				topic: 'simplicity',
				action: 'remove'
			});
			expect(removed.body.done.sort()).toEqual(
				[has.publicId, lacks.publicId].sort()
			);
			const only = await post('topic', {
				ids: [lacks.publicId],
				topic: 'complexity',
				action: 'remove'
			});
			expect(only.body.skipped).toEqual([
				{ id: lacks.publicId, reason: 'its only topic' }
			]);
			expect(
				(
					await post('topic', {
						ids: [has.publicId],
						topic: 'nope',
						action: 'add'
					})
				).status
			).toBe(409);
		});

		it('is for admins only', async () => {
			const member = (await app.signIn(TEST_USER.email, TEST_USER.password))
				.cookie!;
			const q = await quote('VERIFIED');
			expect(
				(await post('withdraw', { ids: [q.publicId], note: 'x' }, member))
					.status
			).toBe(403);
			expect(
				(
					await post(
						'topic',
						{ ids: [q.publicId], topic: 'complexity', action: 'add' },
						member
					)
				).status
			).toBe(403);
		});
	});
});
