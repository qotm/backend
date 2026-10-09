import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import type IoRedis from 'ioredis';
import { CacheService } from './cache.service';

const HITS_PREFIX = 'throttle';

/**
 * Increment the hit counter and decide whether the tracker is blocked, in a
 * single round-trip. Splitting this into INCR + PTTL + SET would let two
 * concurrent requests both observe a below-limit count.
 *
 * KEYS: hits, block. ARGV: ttl(ms), limit, blockDuration(ms).
 * Returns: { totalHits, hitsPttl(ms), isBlocked(0|1), blockPttl(ms) }.
 */
const INCREMENT_SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

-- Already serving a block: report it without consuming another hit.
local blockPttl = redis.call('PTTL', blockKey)
if blockPttl > 0 then
	local hits = tonumber(redis.call('GET', hitsKey)) or (limit + 1)
	local hitsPttl = redis.call('PTTL', hitsKey)
	if hitsPttl < 0 then hitsPttl = 0 end
	return { hits, hitsPttl, 1, blockPttl }
end

local hits = redis.call('INCR', hitsKey)
if hits == 1 then
	redis.call('PEXPIRE', hitsKey, ttl)
end

local hitsPttl = redis.call('PTTL', hitsKey)
if hitsPttl < 0 then
	-- Key exists without a TTL (or raced with expiry); re-arm the window.
	redis.call('PEXPIRE', hitsKey, ttl)
	hitsPttl = ttl
end

if hits > limit then
	redis.call('SET', blockKey, '1', 'PX', blockDuration)
	return { hits, hitsPttl, 1, blockDuration }
end

return { hits, hitsPttl, 0, 0 }
`;

type IncrementResult = [number, number, number, number];

type ThrottlerRedis = IoRedis & {
	throttlerIncrement(
		hitsKey: string,
		blockKey: string,
		ttl: number,
		limit: number,
		blockDuration: number
	): Promise<IncrementResult>;
};

/**
 * Redis-backed {@link ThrottlerStorage}, sharing the ioredis connection already
 * opened by {@link CacheService}. In-memory storage would give each process its
 * own buckets, which is wrong as soon as more than one instance runs.
 *
 * `ttl` and `blockDuration` arrive in milliseconds; `timeToExpire` and
 * `timeToBlockExpire` are returned in seconds, matching `ThrottlerStorageService`.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
	private readonly redis: ThrottlerRedis;

	constructor(private readonly cache: CacheService) {
		this.redis = this.cache.db as ThrottlerRedis;
		this.redis.defineCommand('throttlerIncrement', {
			numberOfKeys: 2,
			lua: INCREMENT_SCRIPT
		});
	}

	async increment(
		key: string,
		ttl: number,
		limit: number,
		blockDuration: number,
		throttlerName: string
	): Promise<ThrottlerStorageRecord> {
		const hitsKey = `${HITS_PREFIX}:${throttlerName}:${key}`;
		const [totalHits, hitsPttl, isBlocked, blockPttl] =
			await this.redis.throttlerIncrement(
				hitsKey,
				`${hitsKey}:block`,
				ttl,
				limit,
				blockDuration
			);

		return {
			totalHits,
			timeToExpire: toSeconds(hitsPttl),
			isBlocked: isBlocked === 1,
			timeToBlockExpire: toSeconds(blockPttl)
		};
	}
}

const toSeconds = (milliseconds: number) =>
	Math.ceil(Math.max(milliseconds, 0) / 1000);
