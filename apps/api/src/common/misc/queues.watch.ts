import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { HealthIndicatorResult } from '@nestjs/terminus';
import { CustomConfigService } from 'common/services/config.service';
import { QueuesHealthIndicator } from './queues.indicator';

/** The field OpenObserve's queue alert matches (lowercased there: `healthcheck`). */
export const QUEUES_HEALTH_CHECK = 'queues';

/**
 * Runs /health/queues' checks every minute and logs an error while any is
 * down, so OpenObserve can alert on the log line without anything polling the
 * URL. Logs once more when everything is back.
 */
@Injectable()
export class QueuesHealthWatch {
	private readonly logger = new Logger(QueuesHealthWatch.name);
	private failing = false;

	constructor(
		private readonly queues: QueuesHealthIndicator,
		private readonly config: CustomConfigService
	) {}

	@Interval('queues-health', 60_000)
	async run() {
		if (this.config.app.env === 'test') return;
		await this.check();
	}

	async check(now = Date.now()) {
		const results: HealthIndicatorResult = Object.assign(
			{},
			...(await Promise.all(this.queues.checks(now).map((c) => c())))
		);
		const down = Object.entries(results)
			.filter(([, r]) => r.status === 'down')
			.map(([key, r]) => `${key}: ${String(r.message ?? 'down')}`);
		if (down.length) {
			this.failing = true;
			this.logger.error(
				{ healthCheck: QUEUES_HEALTH_CHECK, down: down.join('; ') },
				'Queues unhealthy'
			);
		} else if (this.failing) {
			this.failing = false;
			this.logger.log(
				{ healthCheck: QUEUES_HEALTH_CHECK },
				'Queues healthy again'
			);
		}
		return down;
	}
}
