import { Logger } from '@nestjs/common';
import type { HealthIndicatorResult } from '@nestjs/terminus';
import type { QueuesHealthIndicator } from 'common/misc/queues.indicator';
import { QueuesHealthWatch } from 'common/misc/queues.watch';
import type { CustomConfigService } from 'common/services/config.service';

const result =
	(key: string, status: 'up' | 'down', message?: string) =>
	async (): Promise<HealthIndicatorResult> => ({
		[key]: { status, ...(message ? { message } : {}) }
	});

describe('QueuesHealthWatch', () => {
	let checks: ReturnType<typeof result>[];
	let watch: QueuesHealthWatch;
	let env: string;
	const error = vi
		.spyOn(Logger.prototype, 'error')
		.mockImplementation(() => {});
	const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

	beforeEach(() => {
		error.mockClear();
		log.mockClear();
		env = 'production';
		checks = [result('worker', 'up'), result('queue:mail', 'up')];
		watch = new QueuesHealthWatch(
			{ checks: () => checks } as unknown as QueuesHealthIndicator,
			{
				get app() {
					return { env };
				}
			} as unknown as CustomConfigService
		);
	});

	it('stays quiet while everything is up', async () => {
		await expect(watch.check()).resolves.toEqual([]);
		expect(error).not.toHaveBeenCalled();
		expect(log).not.toHaveBeenCalled();
	});

	it('logs an error naming what is down, every run, then once on recovery', async () => {
		checks = [
			result('worker', 'down', 'No heartbeat from the worker'),
			result('queue:mail', 'up')
		];
		await watch.check();
		await watch.check();
		expect(error).toHaveBeenCalledTimes(2);
		expect(error).toHaveBeenLastCalledWith(
			{ healthCheck: 'queues', down: 'worker: No heartbeat from the worker' },
			'Queues unhealthy'
		);

		checks = [result('worker', 'up')];
		await watch.check();
		await watch.check();
		expect(log).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith(
			{ healthCheck: 'queues' },
			'Queues healthy again'
		);
	});

	it('does not run in the test environment', async () => {
		env = 'test';
		checks = [result('worker', 'down', 'No heartbeat from the worker')];
		await watch.run();
		expect(error).not.toHaveBeenCalled();
	});
});
