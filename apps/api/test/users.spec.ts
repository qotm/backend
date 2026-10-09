import { Response } from 'supertest';
import { AppFactory } from '@test/factory/app';
import { SUPER_USER, TEST_ADMIN, TEST_USER } from '@test/factory/constants';

describe('Users', () => {
	let app: AppFactory;
	let superuserCookie: string;
	let adminCookie: string;
	let userCookie: string;
	let superuserId: string;
	let adminId: string;
	let userId: string;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();

		// Sign in as all 3 roles
		const superuserResult = await app.signIn(
			SUPER_USER.email,
			SUPER_USER.password
		);
		superuserCookie = superuserResult.cookie!;

		const adminResult = await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password);
		adminCookie = adminResult.cookie!;

		const userResult = await app.signIn(TEST_USER.email, TEST_USER.password);
		userCookie = userResult.cookie!;

		// Extract user IDs from sessions
		const superuserSession = await app.request
			.get('/auth/get-session')
			.set('Cookie', superuserCookie);
		superuserId = superuserSession.body.user.id;

		const adminSession = await app.request
			.get('/auth/get-session')
			.set('Cookie', adminCookie);
		adminId = adminSession.body.user.id;

		const userSession = await app.request
			.get('/auth/get-session')
			.set('Cookie', userCookie);
		userId = userSession.body.user.id;
	});

	afterAll(async () => {
		await app.close();
	});

	// The frontends generate their types from this document, so the component
	// names and shapes are part of the contract.
	describe('OpenAPI', () => {
		let doc: any;

		beforeAll(async () => {
			doc = (await app.request.get('/openapi-json')).body;
		});

		it('publishes the user components under their established names', () => {
			expect(Object.keys(doc.components.schemas)).toEqual(
				expect.arrayContaining([
					'UserEntity',
					'PaginatedUserEntity',
					'CurrentUserEntity'
				])
			);
		});

		it('documents dates as date-time strings', () => {
			const { properties } = doc.components.schemas.UserEntity;
			expect(properties.createdAt).toMatchObject({
				type: 'string',
				format: 'date-time'
			});
		});

		it('documents the list filters as query parameters', () => {
			const names = doc.paths['/v1/users'].get.parameters.map(
				(p: { name: string }) => p.name
			);
			expect(names).toEqual(
				expect.arrayContaining(['search', 'limit', 'page', 'role'])
			);
		});

		it('points the list response at PaginatedUserEntity', () => {
			const { schema } =
				doc.paths['/v1/users'].get.responses['200'].content['application/json'];
			expect(schema.$ref).toBe('#/components/schemas/PaginatedUserEntity');
		});
	});

	describe('v1', () => {
		describe('GET: /v1/users', () => {
			describe('as superuser', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get('/v1/users')
						.set('Cookie', superuserCookie);
				});

				it('should return 200', () => {
					expect(response.status).toBe(200);
				});

				it('should return paginated response with list and meta', () => {
					expect(response.body).toHaveProperty('list');
					expect(response.body).toHaveProperty('total');
					expect(response.body).toHaveProperty('currentPage');
					expect(response.body).toHaveProperty('lastPage');
					expect(response.body).toHaveProperty('pageSize');
					expect(Array.isArray(response.body.list)).toBe(true);
				});

				it('should not include the superuser in the list', () => {
					const ids = response.body.list.map((u: any) => u.id);
					expect(ids).not.toContain(superuserId);
				});

				it('should not include any user with superuser role', () => {
					const roles = response.body.list.map((u: any) => u.role);
					expect(roles).not.toContain('superuser');
				});

				it('should return users with expected shape', () => {
					if (response.body.list.length > 0) {
						const user = response.body.list[0];
						expect(user).toHaveProperty('id');
						expect(user).toHaveProperty('name');
						expect(user).toHaveProperty('email');
						expect(user).toHaveProperty('role');
						expect(user).toHaveProperty('createdAt');
						expect(user).toHaveProperty('updatedAt');
					}
				});
			});

			describe('as admin', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get('/v1/users')
						.set('Cookie', adminCookie);
				});

				it('should return 200', () => {
					expect(response.status).toBe(200);
				});

				it('should return paginated list', () => {
					expect(response.body).toHaveProperty('list');
					expect(Array.isArray(response.body.list)).toBe(true);
				});

				it('should not include the requesting admin in the list', () => {
					const ids = response.body.list.map((u: any) => u.id);
					expect(ids).not.toContain(adminId);
				});

				it('should not include superuser role in the list', () => {
					const roles = response.body.list.map((u: any) => u.role);
					expect(roles).not.toContain('superuser');
				});
			});

			describe('as regular user', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get('/v1/users')
						.set('Cookie', userCookie);
				});

				it('should deny access (403)', () => {
					expect(response.status).toBe(403);
				});
			});

			describe('without authentication', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request.get('/v1/users');
				});

				it('should return 401', () => {
					expect(response.status).toBe(401);
				});
			});

			describe('with search filter', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get('/v1/users')
						.query({ search: TEST_USER.name })
						.set('Cookie', adminCookie);
				});

				it('should return 200', () => {
					expect(response.status).toBe(200);
				});

				it('should filter results by the search term', () => {
					expect(response.body.list.length).toBeGreaterThanOrEqual(0);
					for (const user of response.body.list) {
						const matchesName = user.name
							.toLowerCase()
							.includes(TEST_USER.name.toLowerCase());
						const matchesEmail = user.email
							.toLowerCase()
							.includes(TEST_USER.name.toLowerCase());
						expect(matchesName || matchesEmail).toBe(true);
					}
				});
			});

			describe('with role filter', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get('/v1/users')
						.query({ role: 'user' })
						.set('Cookie', adminCookie);
				});

				it('should return 200', () => {
					expect(response.status).toBe(200);
				});

				it('should only return users with the filtered role', () => {
					for (const user of response.body.list) {
						expect(user.role).toBe('user');
					}
				});
			});

			// The error contract the Zod pipe keeps: one 400, one message, prefixed
			// with `Validation:` and the offending field.
			describe('with invalid query parameters', () => {
				it('rejects a search shorter than three characters', async () => {
					const response = await app.request
						.get('/v1/users')
						.query({ search: 'ab' })
						.set('Cookie', adminCookie);
					expect(response.status).toBe(400);
					expect(response.body.message).toBe(
						'Validation: search: Too small: expected string to have >=3 characters'
					);
				});

				it('rejects a non-numeric page', async () => {
					const response = await app.request
						.get('/v1/users')
						.query({ page: 'two' })
						.set('Cookie', adminCookie);
					expect(response.status).toBe(400);
					expect(response.body.message).toMatch(/^Validation: page: /);
				});

				it('rejects a role no user holds', async () => {
					const response = await app.request
						.get('/v1/users')
						.query({ role: 'ghost' })
						.set('Cookie', adminCookie);
					expect(response.status).toBe(400);
					expect(response.body.message).toBe(
						"Validation: role 'ghost' does not exist"
					);
				});

				it('treats a blank search as no search', async () => {
					const response = await app.request
						.get('/v1/users')
						.query({ search: '' })
						.set('Cookie', adminCookie);
					expect(response.status).toBe(200);
				});
			});

			describe('with pagination', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get('/v1/users')
						.query({ page: 1, limit: 1 })
						.set('Cookie', adminCookie);
				});

				it('should return 200', () => {
					expect(response.status).toBe(200);
				});

				it('should respect the limit parameter', () => {
					expect(response.body.list.length).toBeLessThanOrEqual(1);
					expect(response.body.pageSize).toBeLessThanOrEqual(1);
				});

				it('should return page meta', () => {
					expect(response.body.currentPage).toBe(1);
					expect(typeof response.body.total).toBe('number');
					expect(typeof response.body.lastPage).toBe('number');
				});
			});
		});

		describe('GET: /v1/users/:id', () => {
			describe('as superuser', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get(`/v1/users/${userId}`)
						.set('Cookie', superuserCookie);
				});

				it('should return 200', () => {
					expect(response.status).toBe(200);
				});

				it('should return the user with expected shape', () => {
					expect(response.body).toHaveProperty('id', userId);
					expect(response.body).toHaveProperty('name');
					expect(response.body).toHaveProperty('email');
					expect(response.body).toHaveProperty('role');
					expect(response.body).toHaveProperty('createdAt');
					expect(response.body).toHaveProperty('updatedAt');
				});
			});

			describe('as admin', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get(`/v1/users/${userId}`)
						.set('Cookie', adminCookie);
				});

				it('should return 200', () => {
					expect(response.status).toBe(200);
				});

				it('should return the requested user', () => {
					expect(response.body.id).toBe(userId);
					expect(response.body.email).toBe(TEST_USER.email);
				});
			});

			describe('as regular user', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get(`/v1/users/${adminId}`)
						.set('Cookie', userCookie);
				});

				it('should deny access (403)', () => {
					expect(response.status).toBe(403);
				});
			});

			describe('without authentication', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request.get(`/v1/users/${userId}`);
				});

				it('should return 401', () => {
					expect(response.status).toBe(401);
				});
			});

			describe('when looking up own ID', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get(`/v1/users/${adminId}`)
						.set('Cookie', adminCookie);
				});

				it('should return 404', () => {
					expect(response.status).toBe(404);
				});
			});

			describe('when looking up superuser', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get(`/v1/users/${superuserId}`)
						.set('Cookie', adminCookie);
				});

				it('should return 404 (superuser is hidden)', () => {
					expect(response.status).toBe(404);
				});
			});

			describe('when user does not exist', () => {
				let response: Response;

				beforeAll(async () => {
					response = await app.request
						.get('/v1/users/00000000-0000-0000-0000-000000000000')
						.set('Cookie', adminCookie);
				});

				it('should return 404', () => {
					expect(response.status).toBe(404);
				});
			});
		});

		describe('GET: /users (without version)', () => {
			it('should return 404 when version prefix is missing', async () => {
				const response = await app.request
					.get('/users')
					.set('Cookie', adminCookie);
				expect(response.status).toBe(404);
			});
		});
	});
});
