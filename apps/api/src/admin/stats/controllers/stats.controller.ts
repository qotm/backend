import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Op, Returns } from 'common/decorators';
import { DashboardPermissions } from '../decorators';
import {
	DashboardStatsEntity,
	OldestItemsEntity,
	QueueCountsEntity
} from '../entity';
import { StatsService } from '../services';

@ApiTags('Admin · Dashboard')
@Controller({ path: 'admin', version: '1' })
export class StatsController {
	constructor(private service: StatsService) {}

	@Get('stats')
	@Op(
		'admin/stats',
		'/v1/admin/stats',
		'The dashboard: queues, corpus quality and community figures (30 days)'
	)
	@Returns(DashboardStatsEntity)
	@DashboardPermissions('read')
	stats() {
		return this.service.stats();
	}

	@Get('stats/counts')
	@Op(
		'admin/stats/counts',
		'/v1/admin/stats/counts',
		'Queue sizes for the admin sidebar (cached 30 seconds)'
	)
	@Returns(QueueCountsEntity)
	@DashboardPermissions('counts')
	counts() {
		return this.service.counts();
	}

	@Get('queues/oldest')
	@Op(
		'admin/queues/oldest',
		'/v1/admin/queues/oldest',
		'The longest-waiting items across the queues'
	)
	@Returns(OldestItemsEntity)
	@DashboardPermissions('read')
	oldest() {
		return this.service.oldest();
	}
}
