import { Response } from 'supertest';
import { AppFactory } from '@test/factory/app';
import { SUPER_USER } from '@test/factory/constants';

describe('Auth', () => {
	let app: AppFactory;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
	});

	afterAll(async () => {
		await app.close();
	});

	describe('Sign in with email [ /auth/sign-in/email ]', () => {
		describe('with valid credentials', () => {
			let response: Response;
			let cookie: string | undefined;

			beforeAll(async () => {
				const result = await app.signIn(SUPER_USER.email, SUPER_USER.password);
				response = result.response;
				cookie = result.cookie;
			});

			it('should succeed with logged in user', () => {
				expect(response.status).toBe(200);
				expect(response.body).toHaveProperty('user');
				expect(response.body.user).toHaveProperty('email', SUPER_USER.email);
			});

			it('should establish a session (cookie)', () => {
				expect(cookie).toBeDefined();
			});

			describe('Protected route: /auth/get-session', () => {
				let res: Response;

				beforeAll(async () => {
					res = await app.request
						.get('/auth/get-session')
						.set('Cookie', cookie!);
				});

				it('should allow access with valid session cookie', () => {
					expect(res.status).toBe(200);
				});

				it('should return the session information', async () => {
					expect(res.body).toHaveProperty('session');
					expect(res.body.session).toMatchObject({
						id: expect.any(String),
						expiresAt: expect.any(String),
						token: expect.any(String),
						createdAt: expect.any(String),
						updatedAt: expect.any(String),
						ipAddress: expect.any(String),
						userAgent: expect.any(String),
						userId: expect.any(String),
						impersonatedBy: null
					});
				});

				it('should return the user information', async () => {
					expect(res.body).toHaveProperty('user');
					expect(res.body.user).toHaveProperty('name', SUPER_USER.name);
					expect(res.body.user).toHaveProperty('email', SUPER_USER.email);
				});
			});
		});

		describe('otherwise', () => {
			let response: Response;
			let cookie: string | undefined;

			beforeAll(async () => {
				const result = await app.signIn('wrong@example.com', 'invalid');
				response = result.response;
				cookie = result.cookie;
			});

			it('should return error for wrong credentials', async () => {
				expect([400, 401]).toContain(response.status);
			});

			it('should NOT set a session cookie', () => {
				expect(cookie).toBeUndefined();
			});

			describe('Protected route: /auth/get-session', () => {
				let res: Response;

				beforeAll(async () => {
					res = await app.request
						.get('/auth/get-session')
						.set('Cookie', cookie || '');
				});

				it('should NOT allow access', () => {
					expect(res.status).toBe(200);
					expect(res.body).toBeNull();
				});
			});
		});
	});
});
