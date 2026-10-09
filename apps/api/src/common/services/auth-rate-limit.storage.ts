import type IoRedis from 'ioredis';
import { CacheService } from './cache.service';

const PREFIX = 'auth:rl';

/**
 * Count one request against a fixed window and decide whether it is allowed,
 * in a single round-trip. A separate GET + SET would let concurrent requests
 * all read a below-limit count before any increment lands.
 *
 * Denied requests are not counted, so the window is not extended while a
 * client keeps retrying.
 *
 * KEYS: counter. ARGV: window(ms), max.
 * Returns: { allowed(0|1), pttl(ms) } — pttl is only meaningful when denied.
 */
const CONSUME_SCRIPT = `
local key = KEYS[1]
local window = tonumber(ARGV[1])
local max = tonumber(ARGV[2])

local count = tonumber(redis.call('GET', key)) or 0
if count >= max then
	local pttl = redis.call('PTTL', key)
	if pttl < 0 then
		-- Key exists without a TTL; re-arm it so the client is not locked out.
		redis.call('PEXPIRE', key, window)
		pttl = window
	end
	return { 0, pttl }
end

if redis.call('INCR', key) == 1 then
	redis.call('PEXPIRE', key, window)
end

return { 1, 0 }
`;

type AuthRateLimitRedis = IoRedis & {
	authRateLimitConsume(
		key: string,
		window: number,
		max: number
	): Promise<[number, number]>;
};

/**
 * Redis-backed storage for better-auth's `/auth/*` rate limiter.
 *
 * Passed as `rateLimit.customStorage` rather than `secondaryStorage`: the latter
 * is also consumed by better-auth's internal adapter for **session** persistence,
 * so setting it would silently relocate sessions out of Postgres. `customStorage`
 * is rate-limit-scoped and takes precedence over `rateLimit.storage`.
 *
 * better-auth passes each rule's `window` in seconds and expects `retryAfter`
 * back in seconds.
 */
export const createAuthRateLimitStorage = (cache: CacheService) => {
	const redis = cache.db as AuthRateLimitRedis;
	redis.defineCommand('authRateLimitConsume', {
		numberOfKeys: 1,
		lua: CONSUME_SCRIPT
	});

	return {
		consume: async (key: string, rule: { window: number; max: number }) => {
			const [allowed, pttl] = await redis.authRateLimitConsume(
				`${PREFIX}:${key}`,
				rule.window * 1000,
				rule.max
			);

			return allowed === 1
				? { allowed: true, retryAfter: null }
				: { allowed: false, retryAfter: Math.ceil(pttl / 1000) };
		}
	};
};
