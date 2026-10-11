import { AppFactory } from '@test/factory/app';
import { SUPER_USER, TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import { auth } from 'lib/auth';

/** Settings: /v1/me and its terminals, against the real test stack. */
describe('Me', () => {
	let app: AppFactory;
	let userCookie: string;
	let adminCookie: string;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		userCookie = (await app.signIn(TEST_USER.email, TEST_USER.password))
			.cookie!;
		adminCookie = (await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password))
			.cookie!;
	});

	afterAll(async () => {
		await app.close();
	});

	const me = (cookie = userCookie) =>
		app.request.get('/v1/me').set('Cookie', cookie);
	const patch = (body: object, cookie = userCookie) =>
		app.request.patch('/v1/me').set('Cookie', cookie).send(body);

	it('needs a session', async () => {
		expect((await app.request.get('/v1/me')).status).toBe(401);
	});

	it('returns my account with its join date', async () => {
		const res = await me();
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			email: TEST_USER.email,
			handle: 'test_user',
			showFavorites: false,
			emailOnReview: true,
			joinedAt: expect.any(String)
		});
	});

	it('updates name, bio and preferences', async () => {
		const res = await patch({
			name: 'Ada Mensah',
			bio: 'Reads old papers so you don’t have to.',
			showFavorites: true,
			emailOnReview: false
		});
		expect(res.body).toMatchObject({
			name: 'Ada Mensah',
			bio: 'Reads old papers so you don’t have to.',
			showFavorites: true,
			emailOnReview: false
		});
		expect((await patch({ bio: 'x'.repeat(161) })).status).toBe(400);
	});

	describe('handles', () => {
		it('changes the handle, keeping the old one in history', async () => {
			const res = await patch({ handle: '@Ada' });
			expect(res.body.handle).toBe('ada');
			const user = await app.db.user.findUniqueOrThrow({
				where: { email: TEST_USER.email }
			});
			expect(
				await app.db.handleHistory.count({
					where: { userId: user.id, oldHandle: 'test_user' }
				})
			).toBe(1);
		});

		it('keeps an old handle reserved for its owner', async () => {
			expect((await patch({ handle: 'test_user' }, adminCookie)).status).toBe(
				409
			);
			const back = await patch({ handle: 'test_user' });
			expect(back.body.handle).toBe('test_user');
		});

		it('refuses a handle someone holds, and a malformed one', async () => {
			expect((await patch({ handle: 'test_admin' })).status).toBe(409);
			expect((await patch({ handle: 'no spaces' })).status).toBe(400);
			expect((await patch({ handle: 'ab' })).status).toBe(400);
		});
	});

	describe('terminals', () => {
		let userId: string;
		let otherDeviceId: string;

		beforeAll(async () => {
			userId = (
				await app.db.user.findUniqueOrThrow({
					where: { email: TEST_USER.email }
				})
			).id;
			const adminId = (
				await app.db.user.findUniqueOrThrow({
					where: { email: TEST_ADMIN.email }
				})
			).id;
			const terminal = async (owner: string, label: string) => {
				const session = await app.db.session.create({
					data: {
						id: `s-${label}`,
						token: `token-${label}`,
						userId: owner,
						expiresAt: new Date(Date.now() + 86_400_000)
					}
				});
				return app.db.device.create({
					data: { userId: owner, label, sessionId: session.id }
				});
			};
			await terminal(userId, 'MacBook · zsh');
			await terminal(userId, 'work laptop · bash');
			otherDeviceId = (await terminal(adminId, 'not yours')).id;
		});

		it('lists my terminals only', async () => {
			const res = await app.request
				.get('/v1/me/devices')
				.set('Cookie', userCookie);
			expect(res.status).toBe(200);
			expect(
				res.body.list.map((d: { label: string }) => d.label).sort()
			).toEqual(['MacBook · zsh', 'work laptop · bash']);
			expect(
				res.body.list.every((d: { current: boolean }) => d.current === false)
			).toBe(true);
		});

		it('revokes one: it keeps its row, its token ends', async () => {
			const device = await app.db.device.findFirstOrThrow({
				where: { label: 'MacBook · zsh' }
			});
			const res = await app.request
				.delete(`/v1/me/devices/${device.id}`)
				.set('Cookie', userCookie);
			expect(res.status).toBe(200);
			const after = await app.db.device.findUniqueOrThrow({
				where: { id: device.id }
			});
			expect(after.revokedAt).not.toBeNull();
			expect(
				await app.db.session.count({ where: { id: 's-MacBook · zsh' } })
			).toBe(0);
			expect(
				(
					await app.request
						.get('/v1/user')
						.set('Authorization', 'Bearer token-MacBook · zsh')
				).status
			).toBe(401);
		});

		it('404s someone else’s terminal', async () => {
			const res = await app.request
				.delete(`/v1/me/devices/${otherDeviceId}`)
				.set('Cookie', userCookie);
			expect(res.status).toBe(404);
			expect(
				(
					await app.db.device.findUniqueOrThrow({
						where: { id: otherDeviceId }
					})
				).revokedAt
			).toBeNull();
		});
	});

	describe('deleting the account', () => {
		let quoteN = 0;
		async function member(email: string) {
			await auth.api.createUser({
				body: { name: 'Leaving', email, password: 'secret', role: 'member' }
			});
			const user = await app.db.user.update({
				where: { email },
				data: { emailVerified: true }
			});
			return { user, cookie: (await app.signIn(email, 'secret')).cookie! };
		}
		const quote = (data: object) =>
			app.db.quote.create({
				data: {
					publicId: `q_me${String(++quoteN).padStart(4, '0')}`,
					text: `Quote ${quoteN}`,
					type: 'CANONICAL',
					status: 'VERIFIED',
					publishedAt: new Date(),
					...data
				}
			});

		it('needs the handle as confirmation', async () => {
			const res = await app.request
				.delete('/v1/me')
				.set('Cookie', userCookie)
				.send({ confirm: 'nope' });
			expect(res.status).toBe(400);
		});

		it('refuses the superuser', async () => {
			const su = (await app.signIn(SUPER_USER.email, SUPER_USER.password))
				.cookie!;
			const handle = (await me(su)).body.handle;
			expect(
				(
					await app.request
						.delete('/v1/me')
						.set('Cookie', su)
						.send({ confirm: handle })
				).status
			).toBe(409);
		});

		it('deletes private quotes, re-credits public ones, and takes back reaction counts', async () => {
			const { user, cookie } = await member('leaving@example.com');
			const priv = await quote({
				type: 'PRIVATE',
				status: 'PRIVATE',
				contributorId: user.id,
				publishedAt: null
			});
			const pub = await quote({ contributorId: user.id });
			const liked = await quote({});
			await app.request
				.post(`/v1/quotes/${liked.publicId}/like`)
				.set('Cookie', cookie);
			await app.request
				.post(`/v1/quotes/${liked.publicId}/favorite`)
				.set('Cookie', cookie);

			const res = await app.request
				.delete('/v1/me')
				.set('Cookie', cookie)
				.send({ confirm: user.handle });
			expect(res.status).toBe(200);
			expect(await app.db.user.count({ where: { id: user.id } })).toBe(0);
			expect(await app.db.quote.count({ where: { id: priv.id } })).toBe(0);
			expect(
				(await app.db.quote.findUniqueOrThrow({ where: { id: pub.id } }))
					.contributorId
			).toBeNull();
			const after = await app.db.quote.findUniqueOrThrow({
				where: { id: liked.id }
			});
			expect([after.likeCount, after.favoriteCount]).toEqual([0, 0]);
			expect(
				(await app.request.get('/v1/me').set('Cookie', cookie)).status
			).toBe(401);
		});

		it('is one transaction: a failure leaves everything as it was', async () => {
			const { user, cookie } = await member('stuck@example.com');
			const liked = await quote({});
			await app.request
				.post(`/v1/quotes/${liked.publicId}/like`)
				.set('Cookie', cookie);
			// A private quote a release still references cannot be deleted
			// (ReleaseQuote is Restrict), so the transaction fails part-way.
			const priv = await quote({
				type: 'PRIVATE',
				status: 'PRIVATE',
				contributorId: user.id
			});
			await app.db.release.create({
				data: {
					version: 'v2026.01.1',
					schemaVersion: 1,
					quotes: { create: { quoteId: priv.id, textAtRelease: 'x' } }
				}
			});

			const res = await app.request
				.delete('/v1/me')
				.set('Cookie', cookie)
				.send({ confirm: user.handle });
			expect(res.status).toBeGreaterThanOrEqual(400);
			expect(await app.db.user.count({ where: { id: user.id } })).toBe(1);
			expect(await app.db.quote.count({ where: { id: priv.id } })).toBe(1);
			expect(
				(await app.db.quote.findUniqueOrThrow({ where: { id: liked.id } }))
					.likeCount
			).toBe(1);
		});
	});
});
