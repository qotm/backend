import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import {
	HealthCheckService,
	HttpHealthIndicator,
	HealthCheck,
	DiskHealthIndicator,
	MemoryHealthIndicator
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { Op } from 'common/decorators';
import { CustomConfigService } from '../services';
import { PrismaHealthIndicator, QueuesHealthIndicator } from '../misc';

const MB = 1024 * 1024;

@ApiTags('App')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
// Probed on a fixed interval by orchestrators; throttling it would take the
// service out of rotation under exactly the load it exists to report on.
@SkipThrottle()
export class HealthController {
	constructor(
		private health: HealthCheckService,
		private http: HttpHealthIndicator,
		private config: CustomConfigService,
		private prisma: PrismaHealthIndicator,
		private disk: DiskHealthIndicator,
		private memory: MemoryHealthIndicator,
		private queues: QueuesHealthIndicator
	) {}

	@Get()
	@ApiExcludeEndpoint()
	@Op('health', '/health', 'Check the health of the server')
	@HealthCheck()
	@AllowAnonymous()
	async check() {
		const { heapMaxMb, rssMaxMb, diskThreshold, diskPath } = this.config.health;
		return this.health.check([
			() => this.http.pingCheck('http', this.config.app.host),
			() => this.prisma.isHealthy('database'),
			() => this.memory.checkHeap('memory_heap', heapMaxMb * MB),
			() => this.memory.checkRSS('memory_rss', rssMaxMb * MB),
			() =>
				this.disk.checkStorage('disk_storage', {
					thresholdPercent: diskThreshold,
					path: diskPath
				})
		]);
	}

	/**
	 * For an uptime monitor, not the container check: whether the worker is
	 * alive and every queue is being consumed (QueuesHealthIndicator). 503
	 * when a queue has stopped, with which and why.
	 */
	@Get('queues')
	@ApiExcludeEndpoint()
	@Op('health-queues', '/health/queues', 'Check the worker and the queues')
	@HealthCheck()
	@AllowAnonymous()
	async queuesCheck() {
		return this.health.check(this.queues.checks());
	}
}
