import { AppFactory } from '@test/factory/app';
import { TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import { recordAudit } from 'audit';
import { auth } from 'lib/auth';

/** GET /v1/admin/audit, against the real test stack. */
describe('Admin audit log', () => {
	let app: AppFactory;
	let admin: string;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		admin = (await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password)).cookie!;
		const entries = [
			{
				actor: { id: 'x', handle: 'mireille' },
				action: 'release.preview_built',
				target: { type: 'release', id: 'v2026.09.1' },
				note: '+74 ~9 −4'
			},
			{
				actor: { id: 'x', handle: 'kofi' },
				action: 'quote.withdrawn',
				target: { type: 'quote', id: 'q_5d3a8w' },
				note: 'No source found; report r_0412'
			},
			{
				actor: { id: 'x', handle: 'mireille' },
				action: 'user.role_changed',
				target: { type: 'user', id: 'kofi' },
				note: 'member → moderator'
			},
			{
				actor: null,
				action: 'quote.published',
				target: { type: 'quote', id: 'q_4r8y1p' }
			}
		] as const;
		let at = Date.UTC(2026, 8, 20);
		for (const entry of entries) {
			const row = await recordAudit(app.db, { ...entry, actor: null });
			await app.db.auditLog.update({
				where: { id: row.id },
				data: {
					actorHandle: entry.actor?.handle ?? null,
					at: new Date((at += 3_600_000))
				}
			});
		}
	});

	afterAll(async () => {
		await app.close();
	});

	const list = (query: Record<string, string | number> = {}, cookie = admin) =>
		app.request.get('/v1/admin/audit').query(query).set('Cookie', cookie);
	const targets = (body: { list: { target: { id: string } }[] }) =>
		body.list.map((e) => e.target.id);

	it('is for admins only', async () => {
		expect((await app.request.get('/v1/admin/audit')).status).toBe(401);
		const member = (await app.signIn(TEST_USER.email, TEST_USER.password))
			.cookie!;
		expect((await list({}, member)).status).toBe(403);
		const email = 'moderator.a@example.com';
		await auth.api.createUser({
			body: { name: 'Mod', email, password: 'secret', role: 'moderator' }
		});
		await app.db.user.update({
			where: { email },
			data: { emailVerified: true }
		});
		const moderator = (await app.signIn(email, 'secret')).cookie!;
		expect((await list({}, moderator)).status).toBe(403);
		expect(
			(
				await app.request
					.get('/v1/admin/audit/actions')
					.set('Cookie', moderator)
			).status
		).toBe(403);
	});

	it('lists newest first, with labels', async () => {
		const res = await list();
		expect(res.status).toBe(200);
		expect(targets(res.body)).toEqual([
			'q_4r8y1p',
			'kofi',
			'q_5d3a8w',
			'v2026.09.1'
		]);
		expect(res.body.list[1]).toEqual({
			id: expect.any(String),
			at: '2026-09-20T03:00:00.000Z',
			actor: { handle: 'mireille' },
			action: 'user.role_changed',
			label: 'Changed role',
			target: { type: 'user', id: 'kofi' },
			note: 'member → moderator'
		});
		expect(res.body.list[0].actor).toBeNull();
	});

	it('filters by action, and rejects an unknown one', async () => {
		const res = await list({ action: 'quote.withdrawn' });
		expect(targets(res.body)).toEqual(['q_5d3a8w']);
		expect((await list({ action: 'quote.deleted' })).status).toBe(400);
	});

	it('searches actor, action label, target and note', async () => {
		expect(targets((await list({ q: '@mireille' })).body)).toEqual([
			'kofi',
			'v2026.09.1'
		]);
		// "kofi" is both an actor and a target.
		expect(targets((await list({ q: 'kofi' })).body)).toEqual([
			'kofi',
			'q_5d3a8w'
		]);
		expect(targets((await list({ q: 'withdrew' })).body)).toEqual(['q_5d3a8w']);
		expect(targets((await list({ q: 'v2026.09' })).body)).toEqual([
			'v2026.09.1'
		]);
		expect(targets((await list({ q: 'r_0412' })).body)).toEqual(['q_5d3a8w']);
	});

	it('pages', async () => {
		const res = await list({ limit: 3, page: 2 });
		expect(res.body).toMatchObject({ total: 4, lastPage: 2, currentPage: 2 });
		expect(targets(res.body)).toEqual(['v2026.09.1']);
	});

	it('lists the actions for the filter', async () => {
		const res = await app.request
			.get('/v1/admin/audit/actions')
			.set('Cookie', admin);
		expect(res.body.list).toContainEqual({
			action: 'user.role_changed',
			label: 'Changed role'
		});
	});
});
