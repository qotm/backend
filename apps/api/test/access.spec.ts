import { AppFactory } from '@test/factory/app';
import { SUPER_USER } from '@test/factory/constants';
import Seeder from '@seeders/util';
import { auth } from 'lib/auth';
import { hasPermission, roles } from 'lib/access';

/**
 * The first-admin bootstrap (QOT-5): on an empty database, `yarn db:seed`
 * creates SUPERUSER_EMAIL as the superuser, who holds every permission and can
 * assign roles. Every other account starts as a member.
 */
describe('Access bootstrap', () => {
	let app: AppFactory;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.db.truncate();
		await Seeder.setup(app.db).seed(app.config.superuser);
	});

	afterAll(async () => {
		await app.close();
	});

	it('creates the superuser on an empty database, and only them', async () => {
		const users = await app.db.user.findMany();
		expect(users).toHaveLength(1);
		expect(users[0]).toMatchObject({
			email: SUPER_USER.email,
			role: 'superuser',
			emailVerified: true
		});
	});

	it('gives the superuser every permission of every role', () => {
		for (const role of Object.values(roles)) {
			for (const [resource, actions] of Object.entries(role.statements)) {
				expect(
					hasPermission('superuser', { [resource]: actions as string[] })
				).toBe(true);
			}
		}
	});

	it('lets the superuser sign in and act as an admin', async () => {
		const { cookie } = await app.signIn(SUPER_USER.email, SUPER_USER.password);
		const response = await app.request
			.post('/auth/admin/has-permission')
			.set('Cookie', cookie!)
			.send({ permissions: { audit: ['read'], release: ['publish'] } });
		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({ success: true });
	});

	it('is idempotent: seeding again adds nobody', async () => {
		await Seeder.setup(app.db).seed(app.config.superuser);
		expect(await app.db.user.count()).toBe(1);
	});

	it('starts every other account as a member', async () => {
		await auth.api.createUser({
			body: {
				name: 'New',
				email: 'new.member@example.com',
				password: 'secret-123'
			}
		});
		const user = await app.db.user.findUniqueOrThrow({
			where: { email: 'new.member@example.com' }
		});
		expect(user.role).toBe('member');
	});
});
