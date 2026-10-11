import Config from 'common/services/config.service';
import {
	EMAIL_LIMIT,
	MAGIC_LINK_PATH,
	emailLimitKey,
	isDisposableEmail,
	signInGuard
} from 'lib/sign-in-guard';
import { MAGIC_LINK_TTL_SECONDS, socialProviders } from 'lib/sign-in';

/** Runs the guard as better-auth would for one request. */
async function guard(
	path: string,
	email: string,
	countSends?: (email: string) => Promise<number>
) {
	const middleware = signInGuard(countSends) as unknown as (
		ctx: object
	) => Promise<unknown>;
	return middleware({ path, body: { email } });
}

describe('isDisposableEmail', () => {
	it('flags known disposable domains, case-insensitively', () => {
		expect(isDisposableEmail('someone@mailinator.com')).toBe(true);
		expect(isDisposableEmail('Someone@MAILINATOR.COM')).toBe(true);
	});

	it('passes ordinary providers and malformed input', () => {
		expect(isDisposableEmail('ada@gmail.com')).toBe(false);
		expect(isDisposableEmail('ada@qotm.dev')).toBe(false);
		expect(isDisposableEmail('not-an-email')).toBe(false);
	});
});

describe('emailLimitKey', () => {
	it('is the same for any casing and never contains the address', () => {
		const key = emailLimitKey('Ada@Example.com');
		expect(key).toBe(emailLimitKey('ada@example.com'));
		expect(key).not.toContain('ada');
	});
});

describe('signInGuard', () => {
	it('refuses a disposable address with a 400', async () => {
		await expect(
			guard(MAGIC_LINK_PATH, 'x@mailinator.com')
		).rejects.toMatchObject({
			body: { code: 'DISPOSABLE_EMAIL' }
		});
	});

	it('allows up to the per-email limit, then refuses with a 429', async () => {
		const count = vi.fn();
		count.mockResolvedValueOnce(EMAIL_LIMIT.max);
		await expect(
			guard(MAGIC_LINK_PATH, 'ada@example.com', count)
		).resolves.toBeUndefined();
		count.mockResolvedValueOnce(EMAIL_LIMIT.max + 1);
		await expect(
			guard(MAGIC_LINK_PATH, 'ada@example.com', count)
		).rejects.toMatchObject({
			body: { code: 'TOO_MANY_LINKS' }
		});
	});

	it('leaves every other auth route alone', async () => {
		const count = vi.fn();
		await expect(
			guard('/sign-in/social', 'x@mailinator.com', count)
		).resolves.toBeUndefined();
		expect(count).not.toHaveBeenCalled();
	});
});

describe('socialProviders', () => {
	const keys = (github: string, google: string) => ({
		github: { clientId: github, clientSecret: github && 's' },
		google: { clientId: google, clientSecret: google && 's' }
	});

	it('offers GitHub and Google with their callbacks', () => {
		const providers = socialProviders('https://api.qotm.dev', keys('gh', 'go'));
		expect(providers.github?.redirectURI).toBe(
			'https://api.qotm.dev/auth/callback/github'
		);
		expect(providers.google?.redirectURI).toBe(
			'https://api.qotm.dev/auth/callback/google'
		);
	});

	it('leaves out a provider without keys', () => {
		expect(Object.keys(socialProviders('x', keys('', 'go')))).toEqual([
			'google'
		]);
		expect(socialProviders('x', keys('', ''))).toEqual({});
	});

	it('expires magic links after 10 minutes', () => {
		expect(MAGIC_LINK_TTL_SECONDS).toBe(600);
	});
});

describe('AUTH_PASSWORD_ENABLED', () => {
	const base = { ...process.env };

	it('is refused in production', () => {
		const result = Config.schema.safeParse({
			...base,
			APP_ENV: 'production',
			AUTH_PASSWORD_ENABLED: 'true'
		});
		expect(result.success).toBe(false);
	});

	it('defaults to off', () => {
		const env: Record<string, string | undefined> = { ...base };
		delete env.AUTH_PASSWORD_ENABLED;
		const parsed = Config.schema.parse({ ...env, APP_ENV: 'development' });
		expect(parsed.AUTH_PASSWORD_ENABLED).toBe('false');
	});
});
