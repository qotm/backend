import { AppFactory } from '@test/factory/app';
import { TEST_USER } from '@test/factory/constants';

const GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

/** `qotm login` and `qotm logout` against the real test stack (BUILD-PLAN §5). */
describe('Device authorization (qotm login)', () => {
	let app: AppFactory;
	let cookie: string;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		cookie = (await app.signIn(TEST_USER.email, TEST_USER.password)).cookie!;
	});

	afterAll(async () => {
		await app.close();
	});

	const requestCode = (clientId = 'qotm-cli') =>
		app.request.post('/auth/device/code').send({ client_id: clientId });

	/** One poll, as the CLI makes it. The interval is reset first, so tests need not wait 5 s. */
	async function poll(deviceCode: string) {
		await app.db.deviceCode.updateMany({
			where: { deviceCode },
			data: { lastPolledAt: new Date(Date.now() - 60_000) }
		});
		return app.request.post('/auth/device/token').send({
			grant_type: GRANT,
			device_code: deviceCode,
			client_id: 'qotm-cli'
		});
	}

	/**
	 * What the web's /device page does: claim the code while signed in (GET
	 * /auth/device), then approve or deny it.
	 */
	async function decide(
		decision: 'approve' | 'deny',
		userCode: string,
		as = cookie
	) {
		await app.request
			.get('/auth/device')
			.query({ user_code: userCode })
			.set('Cookie', as);
		return app.request
			.post(`/auth/device/${decision}`)
			.set('Cookie', as)
			.set('Origin', app.config.app.frontendHost)
			.send({ userCode });
	}

	/** A full login: code, approval, token. */
	async function login() {
		const code = (await requestCode()).body;
		await decide('approve', code.user_code);
		const token = await poll(code.device_code);
		return token.body.access_token as string;
	}

	it('issues a QTM code for the CLI, valid 15 minutes, polled every 5 seconds', async () => {
		const res = await requestCode();
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			user_code: expect.stringMatching(/^QTM-[A-HJ-NP-Z2-9]{4}$/),
			verification_uri: `${app.config.app.frontendHost.replace(/\/$/, '')}/device`,
			expires_in: 900,
			interval: 5
		});
		expect(res.body.verification_uri_complete).toContain(
			encodeURIComponent(res.body.user_code).replace('%2D', '-')
		);
	});

	it('serves the qotm CLI only', async () => {
		expect((await requestCode('someone-else')).status).toBe(400);
	});

	it('tells a polling CLI to wait until the member approves, then gives it a bearer token', async () => {
		const code = (await requestCode()).body;
		const pending = await poll(code.device_code);
		expect(pending.status).toBe(400);
		expect(pending.body.error).toBe('authorization_pending');

		expect((await decide('approve', code.user_code)).status).toBe(200);
		const token = await poll(code.device_code);
		expect(token.status).toBe(200);
		expect(token.body).toMatchObject({
			token_type: 'Bearer',
			access_token: expect.any(String)
		});

		const me = await app.request
			.get('/v1/user')
			.set('Authorization', `Bearer ${token.body.access_token}`);
		expect(me.status).toBe(200);
		expect(me.body.email).toBe(TEST_USER.email);
	});

	it('slows a CLI that polls faster than the interval', async () => {
		const code = (await requestCode()).body;
		await poll(code.device_code);
		const tooSoon = await app.request.post('/auth/device/token').send({
			grant_type: GRANT,
			device_code: code.device_code,
			client_id: 'qotm-cli'
		});
		expect(tooSoon.body.error).toBe('slow_down');
	});

	it('tells the CLI when the member denies', async () => {
		const code = (await requestCode()).body;
		expect((await decide('deny', code.user_code)).status).toBe(200);
		const res = await poll(code.device_code);
		expect(res.body.error).toBe('access_denied');
	});

	it('tells the CLI when the code expired', async () => {
		const code = (await requestCode()).body;
		await app.db.deviceCode.updateMany({
			where: { deviceCode: code.device_code },
			data: { expiresAt: new Date(Date.now() - 1000) }
		});
		const res = await poll(code.device_code);
		expect(res.body.error).toBe('expired_token');
	});

	it('needs a signed-in member to approve', async () => {
		const code = (await requestCode()).body;
		const res = await app.request
			.post('/auth/device/approve')
			.set('Origin', app.config.app.frontendHost)
			.send({ userCode: code.user_code });
		expect(res.status).toBe(401);
	});

	describe('the terminal', () => {
		it('registers with its label and dataset, once per login', async () => {
			const token = await login();
			const register = (label: string) =>
				app.request
					.post('/v1/me/devices')
					.set('Authorization', `Bearer ${token}`)
					.set('X-Qotm-Dataset', 'v2026.08.3')
					.send({ label });

			const first = await register('MacBook · zsh');
			expect(first.status).toBe(201);
			expect(first.body).toMatchObject({
				label: 'MacBook · zsh',
				datasetVersion: 'v2026.08.3',
				lastSyncAt: expect.any(String),
				revokedAt: null
			});
			const again = await register('MacBook · fish');
			expect(again.body.id).toBe(first.body.id);
			expect(again.body.label).toBe('MacBook · fish');
		});

		it('ignores a malformed dataset header', async () => {
			const token = await login();
			const res = await app.request
				.post('/v1/me/devices')
				.set('Authorization', `Bearer ${token}`)
				.set('X-Qotm-Dataset', 'latest; drop table')
				.send({ label: 'work laptop · bash' });
			expect(res.body).toMatchObject({
				datasetVersion: null,
				lastSyncAt: null
			});
		});

		it('logs out: the device is revoked and its token stops working', async () => {
			const token = await login();
			const device = (
				await app.request
					.post('/v1/me/devices')
					.set('Authorization', `Bearer ${token}`)
					.send({ label: 'to log out' })
			).body;

			const out = await app.request
				.delete('/v1/me/devices/current')
				.set('Authorization', `Bearer ${token}`);
			expect(out.status).toBe(200);
			expect(
				(
					await app.request
						.get('/v1/user')
						.set('Authorization', `Bearer ${token}`)
				).status
			).toBe(401);
			expect(
				(await app.db.device.findUniqueOrThrow({ where: { id: device.id } }))
					.revokedAt
			).not.toBeNull();
		});

		it('needs a token', async () => {
			expect(
				(await app.request.post('/v1/me/devices').send({ label: 'x' })).status
			).toBe(401);
		});
	});
});
