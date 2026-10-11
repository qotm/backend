import { AppFactory } from '@test/factory/app';
import { SUPER_USER, TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import { auth } from 'lib/auth';

/** The admin users table and role changes, against the real test stack. */
describe('Admin users', () => {
	let app: AppFactory;
	let admin: string;
	let superuser: string;
	let adminId: string;
	let superId: string;

	async function account(email: string, role: string) {
		await auth.api.createUser({
			body: { name: email, email, password: 'secret', role: role as 'admin' }
		});
		const user = await app.db.user.update({
			where: { email },
			data: { emailVerified: true }
		});
		return { user, cookie: (await app.signIn(email, 'secret')).cookie! };
	}

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		admin = (await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password)).cookie!;
		superuser = (await app.signIn(SUPER_USER.email, SUPER_USER.password))
			.cookie!;
		adminId = (
			await app.db.user.findUniqueOrThrow({
				where: { email: TEST_ADMIN.email }
			})
		).id;
		superId = (
			await app.db.user.findFirstOrThrow({ where: { role: 'superuser' } })
		).id;
	});

	afterAll(async () => {
		await app.close();
	});

	const setRole = (id: string, role: string, cookie = admin) =>
		app.request
			.patch(`/v1/admin/users/${id}/role`)
			.set('Cookie', cookie)
			.send({ role });
	const roleChanges = (handle: string) =>
		app.db.auditLog.findMany({
			where: { action: 'user.role_changed', targetId: handle }
		});

	describe('GET /v1/admin/users', () => {
		it('lists with contribution and curated counts, matching the profile', async () => {
			const user = await app.db.user.findUniqueOrThrow({
				where: { email: TEST_USER.email }
			});
			let n = 0;
			for (const [status, type] of [
				['CURATED', 'CANONICAL'],
				['VERIFIED', 'CANONICAL'],
				['PUBLISHED', 'ORIGINAL'],
				['SUBMITTED', 'CANONICAL'], // not public yet
				['PRIVATE', 'PRIVATE']
			] as const) {
				await app.db.quote.create({
					data: {
						publicId: `q_au000${n}`,
						text: `Admin users ${n++}`,
						status,
						type,
						contributorId: user.id
					}
				});
			}
			const res = await app.request
				.get('/v1/admin/users?search=@test_user')
				.set('Cookie', admin);
			expect(res.status).toBe(200);
			expect(res.body.list).toHaveLength(1);
			expect(res.body.list[0]).toMatchObject({
				handle: 'test_user',
				role: 'member',
				contributions: 3,
				curated: 1
			});
			const profile = await app.request.get('/v1/users/test_user');
			expect(profile.body.stats).toMatchObject({
				contributions: 3,
				curated: 1
			});
		});
	});

	describe('PATCH /v1/admin/users/:id/role', () => {
		it('is for admins only', async () => {
			const { user, cookie } = await account('mod.u@example.com', 'moderator');
			expect(
				(await app.request.patch(`/v1/admin/users/${user.id}/role`)).status
			).toBe(401);
			expect((await setRole(user.id, 'admin', cookie)).status).toBe(403);
			const member = (await app.signIn(TEST_USER.email, TEST_USER.password))
				.cookie!;
			expect((await setRole(user.id, 'admin', member)).status).toBe(403);
			expect(
				(await app.db.user.findUniqueOrThrow({ where: { id: user.id } })).role
			).toBe('moderator');
		});

		it('assigns a role, audited as "member → moderator", effective at once', async () => {
			const { user, cookie } = await account('promoted@example.com', 'member');
			expect(
				(await app.request.get('/v1/admin/reports').set('Cookie', cookie))
					.status
			).toBe(403);

			const res = await setRole(user.id, 'moderator');
			expect(res.status).toBe(200);
			expect(res.body).toMatchObject({ id: user.id, role: 'moderator' });
			const [entry] = await roleChanges(user.handle);
			expect(entry).toMatchObject({
				actorId: adminId,
				actorHandle: 'test_admin',
				targetType: 'user',
				note: 'member → moderator'
			});
			expect(
				(await app.request.get('/v1/admin/reports').set('Cookie', cookie))
					.status
			).toBe(200);
		});

		it('does nothing, and audits nothing, when the role is unchanged', async () => {
			const { user } = await account('same@example.com', 'verifier');
			expect((await setRole(user.id, 'verifier')).status).toBe(200);
			expect(await roleChanges(user.handle)).toHaveLength(0);
		});

		it('never assigns superuser, nor an unknown role', async () => {
			const { user } = await account('climber@example.com', 'member');
			expect((await setRole(user.id, 'superuser')).status).toBe(400);
			expect((await setRole(user.id, 'superuser', superuser)).status).toBe(400);
			expect((await setRole(user.id, 'owner')).status).toBe(400);
		});

		it('hides the superuser from admins, and fixes its role', async () => {
			expect((await setRole(superId, 'member')).status).toBe(404);
			expect((await setRole(superId, 'admin', superuser)).status).toBe(409);
			expect((await setRole('nobody', 'member')).status).toBe(404);
		});

		it('never demotes the last admin', async () => {
			expect(
				(await app.db.user.findMany({ where: { role: 'admin' } })).map(
					(u) => u.id
				)
			).toEqual([adminId]);
			expect((await setRole(adminId, 'member', superuser)).status).toBe(409);
			expect((await setRole(adminId, 'member')).status).toBe(409);

			const { user: second } = await account('second@example.com', 'admin');
			expect((await setRole(second.id, 'moderator')).status).toBe(200);
			expect((await roleChanges(second.handle))[0].note).toBe(
				'admin → moderator'
			);
			expect(
				(await app.db.user.findUniqueOrThrow({ where: { id: adminId } })).role
			).toBe('admin');
		});

		it('lets two admins demote each other, but never both', async () => {
			const { user: other } = await account('other@example.com', 'admin');
			const results = await Promise.all([
				setRole(other.id, 'member'),
				setRole(adminId, 'member', superuser)
			]);
			expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
			expect(await app.db.user.count({ where: { role: 'admin' } })).toBe(1);
		});
	});
});
