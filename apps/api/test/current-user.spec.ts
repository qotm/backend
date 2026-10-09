import { Response } from 'supertest';
import { AppFactory } from '@test/factory/app';
import { SUPER_USER, TEST_ADMIN, TEST_USER } from '@test/factory/constants';

describe('Current User', () => {
	let app: AppFactory;
	let superuserCookie: string;
	let adminCookie: string;
	let userCookie: string;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();

		const superuserResult = await app.signIn(
			SUPER_USER.email,
			SUPER_USER.password
		);
		superuserCookie = superuserResult.cookie!;

		const adminResult = await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password);
		adminCookie = adminResult.cookie!;

		const userResult = await app.signIn(TEST_USER.email, TEST_USER.password);
		userCookie = userResult.cookie!;
	});

	afterAll(async () => {
		await app.close();
	});

	describe('v1', () => {
		describe('GET: /v1/user', () => {
			describe('as superuser', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get('/v1/user')
						.set('Cookie', superuserCookie);
				});

				it('should return 200', () => {
					expect(response.status).toBe(200);
				});

				it('should return current user data', () => {
					expect(response.body).toHaveProperty('id');
					expect(response.body).toHaveProperty('name');
					expect(response.body).toHaveProperty('email', SUPER_USER.email);
					expect(response.body).toHaveProperty('emailVerified');
					expect(response.body).toHaveProperty('createdAt');
					expect(response.body).toHaveProperty('updatedAt');
				});

				it('should include role', () => {
					expect(response.body).toHaveProperty('role');
					expect(response.body.role).toBe('superuser');
				});
			});

			describe('as admin', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get('/v1/user')
						.set('Cookie', adminCookie);
				});

				it('should return 200', () => {
					expect(response.status).toBe(200);
				});

				it('should return admin user data', () => {
					expect(response.body.email).toBe(TEST_ADMIN.email);
					expect(response.body.name).toBe(TEST_ADMIN.name);
				});

				it('should have admin role', () => {
					expect(response.body.role).toBe('admin');
				});
			});

			describe('as regular user', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get('/v1/user')
						.set('Cookie', userCookie);
				});

				it('should return 200', () => {
					expect(response.status).toBe(200);
				});

				it('should return regular user data', () => {
					expect(response.body.email).toBe(TEST_USER.email);
					expect(response.body.name).toBe(TEST_USER.name);
				});

				it('should have user role', () => {
					expect(response.body.role).toBe('user');
				});
			});

			describe('without authentication', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request.get('/v1/user');
				});

				it('should return 401', () => {
					expect(response.status).toBe(401);
				});
			});

			describe('response shape', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get('/v1/user')
						.set('Cookie', userCookie);
				});

				it('should not expose banned fields', () => {
					expect(response.body).not.toHaveProperty('banned');
					expect(response.body).not.toHaveProperty('banReason');
					expect(response.body).not.toHaveProperty('banExpires');
				});

				it('should have image field (nullable)', () => {
					expect(response.body).toHaveProperty('image');
				});

				it('should have emailVerified as boolean', () => {
					expect(typeof response.body.emailVerified).toBe('boolean');
				});
			});
		});

		describe('GET: /user (without version)', () => {
			it('should return 404 when version prefix is missing', async () => {
				const response = await app.request
					.get('/user')
					.set('Cookie', userCookie);
				expect(response.status).toBe(404);
			});
		});
	});
});
