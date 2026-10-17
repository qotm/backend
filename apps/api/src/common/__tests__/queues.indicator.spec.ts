import { HealthIndicatorService } from '@nestjs/terminus';
import type { Queue } from 'bullmq';
import {
	HEARTBEAT_KEY,
	QueuesHealthIndicator,
	STALL_MS,
	stallReason,
	type Heartbeat
} from 'common/misc/queues.indicator';

const NOW = 1_000_000_000;
const MIN = 60_000;

describe('stallReason', () => {
	it('is nothing while no job waits, or the next has not waited long', () => {
		expect(stallReason(null, null, NOW)).toBeNull();
		expect(stallReason(NOW - STALL_MS + 1, null, NOW)).toBeNull();
	});

	it('is nothing for a long wait while jobs keep finishing', () => {
		expect(stallReason(NOW - 60 * MIN, NOW - MIN, NOW)).toBeNull();
	});

	it('is a stall when the next job has waited and nothing has finished', () => {
		expect(stallReason(NOW - 12 * MIN, NOW - 30 * MIN, NOW)).toBe(
			'A job has waited 12 min and nothing has finished'
		);
		expect(stallReason(NOW - 12 * MIN, null, NOW)).toMatch(/waited 12 min/);
	});
});

type Fake = {
	counts?: Record<string, number>;
	wait?: { timestamp: number; delay?: number }[];
	prioritized?: { timestamp: number; delay?: number }[];
	broken?: boolean;
};

function indicator(
	fakes: Partial<Record<string, Fake>>,
	heartbeat: Heartbeat | null | 'unreachable'
) {
	const get = vi.fn(async (key: string) => {
		if (heartbeat === 'unreachable') throw new Error('ECONNREFUSED');
		expect(key).toBe(HEARTBEAT_KEY);
		return heartbeat ? JSON.stringify(heartbeat) : null;
	});
	const queue = (name: string) => {
		const fake = fakes[name] ?? {};
		const fail = () => {
			if (fake.broken || heartbeat === 'unreachable')
				throw new Error('ECONNREFUSED');
		};
		return {
			backend: { client: Promise.resolve({ get }) },
			getJobCounts: vi.fn(async () => (fail(), fake.counts ?? {})),
			getJobs: vi.fn(
				async (type: string) =>
					(fail(), type === 'wait' ? fake.wait : fake.prioritized) ?? []
			)
		} as unknown as Queue;
	};
	return new QueuesHealthIndicator(
		new HealthIndicatorService(),
		queue('matching'),
		queue('releases'),
		queue('share-images'),
		queue('exports'),
		queue('mail'),
		queue('media')
	);
}

const run = async (unit: QueuesHealthIndicator) =>
	Object.assign(
		{},
		...(await Promise.all(unit.checks(NOW).map((check) => check())))
	);

const beat = (over: Partial<Heartbeat> = {}): Heartbeat => ({
	at: NOW - 5_000,
	startedAt: NOW - 120 * MIN,
	queues: {},
	...over
});

describe('QueuesHealthIndicator', () => {
	it('is up with a heartbeat and nothing waiting', async () => {
		const result = await run(indicator({}, beat()));
		expect(result.worker).toEqual({
			status: 'up',
			lastBeatSecondsAgo: 5,
			upSince: new Date(NOW - 120 * MIN).toISOString()
		});
		expect(Object.keys(result)).toEqual([
			'worker',
			'queue:matching',
			'queue:releases',
			'queue:share-images',
			'queue:exports',
			'queue:mail',
			'queue:media'
		]);
		expect(result['queue:matching']).toEqual({
			status: 'up',
			waiting: 0,
			active: 0,
			delayed: 0,
			failed: 0,
			nextWaitingSeconds: null
		});
	});

	it('is down without a heartbeat', async () => {
		const result = await run(indicator({}, null));
		expect(result.worker).toEqual({
			status: 'down',
			message: 'No heartbeat from the worker'
		});
	});

	it('keeps a moving backlog up and a stuck one down', async () => {
		const result = await run(
			indicator(
				{
					// The backfill: an hour of renders queued, one finished a minute ago.
					'share-images': {
						counts: { prioritized: 4000, active: 1 },
						prioritized: [{ timestamp: NOW - 60 * MIN }]
					},
					// Nothing finished since the worker started, two hours ago.
					matching: {
						counts: { waiting: 2 },
						wait: [{ timestamp: NOW - 20 * MIN }, { timestamp: NOW - MIN }]
					}
				},
				beat({
					queues: {
						'share-images': { lastFinishedAt: NOW - MIN },
						matching: { lastFinishedAt: null }
					}
				})
			)
		);
		expect(result['queue:share-images']).toMatchObject({
			status: 'up',
			waiting: 4000,
			nextWaitingSeconds: 3600
		});
		expect(result['queue:matching']).toMatchObject({
			status: 'down',
			waiting: 2,
			nextWaitingSeconds: 1200,
			message: 'A job has waited 20 min and nothing has finished'
		});
	});

	it('counts a delayed job from when it became ready', async () => {
		const result = await run(
			indicator(
				{
					exports: {
						counts: { waiting: 1 },
						wait: [{ timestamp: NOW - 15 * MIN, delay: 10 * MIN }]
					}
				},
				beat()
			)
		);
		expect(result['queue:exports']).toMatchObject({
			status: 'up',
			nextWaitingSeconds: 300
		});
	});

	it("judges the API's own queues by their wait alone", async () => {
		const result = await run(
			indicator(
				{
					mail: {
						counts: { waiting: 1 },
						wait: [{ timestamp: NOW - 11 * MIN }]
					}
				},
				beat({ queues: { mail: { lastFinishedAt: NOW } } })
			)
		);
		expect(result['queue:mail']).toMatchObject({ status: 'down' });
	});

	it('is down everywhere when Redis is unreachable', async () => {
		const result = await run(indicator({}, 'unreachable'));
		expect(result.worker).toEqual({
			status: 'down',
			message: 'Redis unreachable'
		});
		expect(result['queue:mail']).toEqual({
			status: 'down',
			message: 'Redis unreachable'
		});
	});
});
