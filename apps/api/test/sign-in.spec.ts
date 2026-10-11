import { AppFactory } from '@test/factory/app';
import { MailService } from 'common/services';

type MailMock = { magicLink: ReturnType<typeof vi.fn> };

/** The link the last magic-link email carried. */
function lastLink(app: AppFactory) {
	const mail = app.instance.get(MailService) as unknown as MailMock;
	const calls = mail.magicLink.mock.calls;
	const call = calls[calls.length - 1];
	if (!call) throw new Error('No magic link was sent');
	return call[0] as { to: string; url: string; expiresInMinutes: number };
}

/** Every Set-Cookie header of a response, as one string. */
const cookies = (res: { headers: Record<string, unknown> }) =>
	([] as string[])
		.concat((res.headers['set-cookie'] as string | string[]) ?? [])
		.join(';');

/** The path and query of an absolute link, for supertest. */
const pathOf = (url: string) => {
	const u = new URL(url);
	return `${u.pathname}${u.search}`;
};

let ip = 0;
const client = () => `10.35.${Math.floor(++ip / 250)}.${ip % 250}`;

/** OAuth providers this spec needs, whatever keys the local .env.test has. */
const PROVIDERS = {
	OAUTH_GITHUB_CLIENT_ID: 'test-github-id',
	OAUTH_GITHUB_CLIENT_SECRET: 'test-github-secret',
	OAUTH_GOOGLE_CLIENT_ID: 'test-google-id',
	OAUTH_GOOGLE_CLIENT_SECRET: 'test-google-secret'
};

describe('Sign-in: magic links and OAuth', () => {
	let app: AppFactory;
	const previous = Object.fromEntries(
		Object.keys(PROVIDERS).map((key) => [key, process.env[key]])
	);

	beforeAll(async () => {
		for (const [key, value] of Object.entries(PROVIDERS)) {
			process.env[key] ||= value;
		}
		app = await AppFactory.init();
		await app.refresh();
	});

	afterAll(async () => {
		await app.close();
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});

	const requestLink = (email: string) =>
		app.request
			.post('/auth/sign-in/magic-link')
			.set('X-Forwarded-For', client())
			.send({ email, callbackURL: '/' });

	it('emails a link that expires in 10 minutes', async () => {
		const res = await requestLink('first.timer@example.com');
		expect(res.status).toBe(200);
		expect(lastLink(app)).toMatchObject({
			to: 'first.timer@example.com',
			expiresInMinutes: 10,
			url: expect.stringContaining('/auth/magic-link/verify?token=')
		});
	});

	it('creates the account on first use, as a member with a handle, and signs in', async () => {
		await requestLink('new.member@example.com');
		const res = await app.request.get(pathOf(lastLink(app).url));
		expect(res.status).toBe(302);
		expect(cookies(res)).toContain('session_token');

		const user = await app.db.user.findUniqueOrThrow({
			where: { email: 'new.member@example.com' }
		});
		expect(user).toMatchObject({
			role: 'member',
			handle: 'new_member',
			emailVerified: true
		});
	});

	it('signs an existing account in without making another', async () => {
		await requestLink('new.member@example.com');
		await app.request.get(pathOf(lastLink(app).url));
		expect(
			await app.db.user.count({ where: { email: 'new.member@example.com' } })
		).toBe(1);
	});

	it('works only once', async () => {
		await requestLink('once.only@example.com');
		const url = pathOf(lastLink(app).url);
		const first = await app.request.get(url);
		expect(cookies(first)).toContain('session_token');
		const again = await app.request.get(url);
		expect(again.status).toBe(302);
		expect(again.headers.location).toContain('error=INVALID_TOKEN');
		expect(cookies(again)).not.toContain('session_token=');
	});

	it('refuses an expired link', async () => {
		await requestLink('too.late@example.com');
		const { url } = lastLink(app);
		await app.db.verification.updateMany({
			where: { value: { contains: 'too.late@example.com' } },
			data: { expiresAt: new Date(Date.now() - 1000) }
		});
		const res = await app.request.get(pathOf(url));
		expect(res.headers.location).toContain('error=INVALID_TOKEN');
		expect(
			await app.db.user.count({ where: { email: 'too.late@example.com' } })
		).toBe(0);
	});

	it('refuses a disposable address and sends nothing', async () => {
		const mail = app.instance.get(MailService) as unknown as MailMock;
		const before = mail.magicLink.mock.calls.length;
		const res = await requestLink('someone@mailinator.com');
		expect(res.status).toBe(400);
		expect(res.body).toMatchObject({ code: 'DISPOSABLE_EMAIL' });
		expect(mail.magicLink.mock.calls.length).toBe(before);
	});

	it.each([
		['github', 'https://github.com/login/oauth/authorize'],
		['google', 'https://accounts.google.com/']
	])('offers "Continue with %s"', async (provider, authorize) => {
		const res = await app.request
			.post('/auth/sign-in/social')
			.send({ provider, callbackURL: '/' });
		expect(res.status).toBe(200);
		expect(res.body.url).toContain(authorize);
		expect(res.body.url).toContain(
			encodeURIComponent(`/auth/callback/${provider}`)
		);
	});
});

describe('Sign-in: passwords off outside the test environment', () => {
	let app: AppFactory;
	const previous = process.env.AUTH_PASSWORD_ENABLED;

	beforeAll(async () => {
		process.env.AUTH_PASSWORD_ENABLED = 'false';
		app = await AppFactory.init();
	});

	afterAll(async () => {
		await app.close();
		process.env.AUTH_PASSWORD_ENABLED = previous;
	});

	it.each([
		[
			'/auth/sign-in/email',
			{ email: 'test.user@example.com', password: 'secret' }
		],
		[
			'/auth/sign-up/email',
			{ email: 'x@example.com', password: 'secret-123', name: 'X' }
		]
	])('refuses %s', async (path, body) => {
		const res = await app.request.post(path).send(body);
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(cookies(res)).not.toContain('session_token=');
	});
});

describe('Sign-in: rate limits', () => {
	let app: AppFactory;
	const previous = process.env.RATE_LIMIT_ENABLED;

	beforeAll(async () => {
		process.env.RATE_LIMIT_ENABLED = 'true';
		app = await AppFactory.init();
		await app.refresh();
	});

	afterAll(async () => {
		await app.close();
		process.env.RATE_LIMIT_ENABLED = previous;
	});

	beforeEach(async () => {
		await app.cache.truncate();
	});

	it('sends at most 3 links per address per 10 minutes', async () => {
		const statuses: number[] = [];
		for (let i = 0; i < 4; i++) {
			const res = await app.request
				.post('/auth/sign-in/magic-link')
				.set('X-Forwarded-For', client())
				.send({ email: 'flood.me@example.com', callbackURL: '/' });
			statuses.push(res.status);
		}
		expect(statuses).toEqual([200, 200, 200, 429]);
	});

	it('takes at most 10 link requests per IP per hour', async () => {
		const statuses: number[] = [];
		for (let i = 0; i < 11; i++) {
			const res = await app.request
				.post('/auth/sign-in/magic-link')
				.set('X-Forwarded-For', '10.35.250.250')
				.send({ email: `person${i}@example.com`, callbackURL: '/' });
			statuses.push(res.status);
		}
		expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
		expect(statuses[10]).toBe(429);
	});
});
