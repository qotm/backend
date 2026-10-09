import { CacheService, RedisThrottlerStorage } from 'common/services';

type IncrementResult = [number, number, number, number];

/**
 * The Lua script itself is exercised against real Redis by `test/rate-limit.spec.ts`.
 * Here we pin the contract around it: argument marshalling and the ms → s
 * conversion that `ThrottlerGuard` relies on for `Retry-After`.
 */
const makeCache = (result: IncrementResult) => {
	const throttlerIncrement = vi.fn().mockResolvedValue(result);
	const defineCommand = vi.fn();
	const cache = {
		db: { defineCommand, throttlerIncrement }
	} as unknown as CacheService;

	return { cache, throttlerIncrement, defineCommand };
};

describe('RedisThrottlerStorage', () => {
	it('registers the Lua command once on construction', () => {
		const { cache, defineCommand } = makeCache([1, 60_000, 0, 0]);
		new RedisThrottlerStorage(cache);

		expect(defineCommand).toHaveBeenCalledWith(
			'throttlerIncrement',
			expect.objectContaining({ numberOfKeys: 2 })
		);
	});

	it('passes the hits and block keys, namespaced by throttler name', async () => {
		const { cache, throttlerIncrement } = makeCache([1, 60_000, 0, 0]);
		const storage = new RedisThrottlerStorage(cache);

		await storage.increment('abc123', 60_000, 30, 60_000, 'default');

		expect(throttlerIncrement).toHaveBeenCalledWith(
			'throttle:default:abc123',
			'throttle:default:abc123:block',
			60_000,
			30,
			60_000
		);
	});

	it('converts millisecond TTLs to the seconds the guard expects', async () => {
		const { cache } = makeCache([1, 59_400, 0, 0]);
		const storage = new RedisThrottlerStorage(cache);

		const record = await storage.increment('k', 60_000, 30, 60_000, 'default');

		expect(record).toEqual({
			totalHits: 1,
			timeToExpire: 60, // ceil(59_400 / 1000)
			isBlocked: false,
			timeToBlockExpire: 0
		});
	});

	it('reports a block with its remaining time in seconds', async () => {
		const { cache } = makeCache([31, 42_000, 1, 30_500]);
		const storage = new RedisThrottlerStorage(cache);

		const record = await storage.increment('k', 60_000, 30, 60_000, 'default');

		expect(record.isBlocked).toBe(true);
		expect(record.totalHits).toBe(31);
		expect(record.timeToBlockExpire).toBe(31); // ceil(30_500 / 1000)
	});

	it('clamps negative TTLs (expired or missing key) to zero', async () => {
		const { cache } = makeCache([1, -2, 0, -2]);
		const storage = new RedisThrottlerStorage(cache);

		const record = await storage.increment('k', 60_000, 30, 60_000, 'default');

		expect(record.timeToExpire).toBe(0);
		expect(record.timeToBlockExpire).toBe(0);
	});
});
