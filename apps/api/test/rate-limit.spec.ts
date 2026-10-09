import { AppFactory } from '@test/factory/app';
import { TEST_USER } from '@test/factory/constants';
import { createAuthRateLimitStorage } from 'common/services';
import { AUTH_RATE_LIMIT_RULES } from 'lib/rate-limit';

// `GET /ping` on AppController carries @Throttle({ limit: 30, ttl: 60_000 }).
const PING = '/ping';
const PING_LIMIT = 30;

describe('Rate limiting', () => {
	let app: AppFactory;

	// .env.test turns throttling off so buckets cannot leak between specs; this
	// spec is the one that needs it on, so it flips the flag before the app boots
	// and restores it afterwards (spec files run one at a time).
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

	// Buckets live in Redis and outlive a single test.
	beforeEach(async () => {
		await app.cache.truncate();
	});

	describe(`GET ${PING}`, () => {
		it('allows requests up to the route limit', async () => {
			for (let i = 0; i < PING_LIMIT; i++) {
				const response = await app.request.get(PING);
				expect(response.status).toBe(200);
			}
		});

		it('returns 429 once the limit is exceeded', async () => {
			for (let i = 0; i < PING_LIMIT; i++) {
				await app.request.get(PING);
			}

			const response = await app.request.get(PING);
			expect(response.status).toBe(429);
		});

		it('sets Retry-After to the seconds remaining on the block', async () => {
			for (let i = 0; i < PING_LIMIT; i++) {
				await app.request.get(PING);
			}

			const response = await app.request.get(PING);
			const retryAfter = Number(response.headers['retry-after']);
			expect(retryAfter).toBeGreaterThan(0);
			expect(retryAfter).toBeLessThanOrEqual(60);
		});

		it('exposes the remaining allowance while under the limit', async () => {
			const response = await app.request.get(PING);
			expect(response.status).toBe(200);
			expect(Number(response.headers['x-ratelimit-limit'])).toBe(PING_LIMIT);
			expect(Number(response.headers['x-ratelimit-remaining'])).toBe(
				PING_LIMIT - 1
			);
		});

		it('keeps counting per-route, so a different route is unaffected', async () => {
			for (let i = 0; i < PING_LIMIT + 1; i++) {
				await app.request.get(PING);
			}
			expect((await app.request.get(PING)).status).toBe(429);

			// Anonymous, separate handler → separate bucket.
			expect((await app.request.get('/')).status).not.toBe(429);
		});
	});

	describe('storage', () => {
		// Guards against silently falling back to throttler's in-memory storage,
		// which would give each process its own buckets once we scale out.
		it('keeps counters in Redis, not in process memory', async () => {
			expect(await app.cache.db.keys('throttle:*')).toHaveLength(0);

			await app.request.get(PING);

			const keys = await app.cache.db.keys('throttle:default:*');
			expect(keys).toHaveLength(1);
			expect(await app.cache.db.get(keys[0])).toBe('1');
		});

		it('sets a TTL on the bucket so the window rolls over', async () => {
			await app.request.get(PING);

			const [key] = await app.cache.db.keys('throttle:default:*');
			const ttl = await app.cache.db.pttl(key);
			expect(ttl).toBeGreaterThan(0);
			expect(ttl).toBeLessThanOrEqual(60_000);
		});

		it('writes a block key once the limit is exceeded', async () => {
			for (let i = 0; i < PING_LIMIT + 1; i++) {
				await app.request.get(PING);
			}

			expect(await app.cache.db.keys('throttle:default:*:block')).toHaveLength(
				1
			);
		});
	});

	// better-auth's own limiter on /auth/*, backed by createAuthRateLimitStorage.
	describe('auth endpoints', () => {
		const SIGN_IN = '/auth/sign-in/email';
		const SIGN_IN_LIMIT = AUTH_RATE_LIMIT_RULES['/sign-in/email'].max;

		// better-auth keys buckets on the client IP and skips limiting entirely
		// when it cannot resolve one, so every request names its client.
		const signIn = (ip = '203.0.113.7') =>
			app.request
				.post(SIGN_IN)
				.set('x-forwarded-for', ip)
				.send({ email: TEST_USER.email, password: 'wrong-password' });

		it('returns 429 once the sign-in limit is exceeded', async () => {
			for (let i = 0; i < SIGN_IN_LIMIT; i++) {
				expect((await signIn()).status).not.toBe(429);
			}

			const response = await signIn();
			expect(response.status).toBe(429);
			const retryAfter = Number(response.headers['x-retry-after']);
			expect(retryAfter).toBeGreaterThan(0);
			expect(retryAfter).toBeLessThanOrEqual(60);
		});

		it('keeps separate buckets per client IP', async () => {
			for (let i = 0; i < SIGN_IN_LIMIT + 1; i++) await signIn();

			expect((await signIn('198.51.100.9')).status).not.toBe(429);
		});

		it('keeps its counters in Redis with the rule window as TTL', async () => {
			await signIn();

			const keys = await app.cache.db.keys('auth:rl:*');
			expect(keys).toHaveLength(1);
			expect(await app.cache.db.get(keys[0])).toBe('1');
			const ttl = await app.cache.db.pttl(keys[0]);
			expect(ttl).toBeGreaterThan(0);
			expect(ttl).toBeLessThanOrEqual(60_000);
		});

		it('admits exactly `max` concurrent requests', async () => {
			// The storage checks and increments in one Redis call; a read-then-write
			// would let every concurrent request see a below-limit count.
			const storage = createAuthRateLimitStorage(app.cache);
			const rule = { window: 60, max: 5 };

			const results = await Promise.all(
				Array.from({ length: 50 }, () => storage.consume('concurrency', rule))
			);

			expect(results.filter((r) => r.allowed)).toHaveLength(rule.max);
		});
	});

	describe('exempt routes', () => {
		it('does not throttle the index route', async () => {
			// Well past any configured limit.
			for (let i = 0; i < PING_LIMIT + 5; i++) {
				const response = await app.request.get('/');
				expect(response.status).not.toBe(429);
			}
		});
	});
});
