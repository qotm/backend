import { Injectable } from '@nestjs/common';
import {
	HealthIndicatorResult,
	HealthIndicatorService
} from '@nestjs/terminus';
import { PrismaService } from 'common/services';

@Injectable()
export class PrismaHealthIndicator {
	constructor(
		private readonly db: PrismaService,
		private readonly healthIndicatorService: HealthIndicatorService
	) {}

	async isHealthy(key: string): Promise<HealthIndicatorResult> {
		const indicator = this.healthIndicatorService.check(key);
		try {
			await this.db.$queryRawUnsafe('SELECT 1');
			return indicator.up();
		} catch {
			return indicator.down({ message: 'Database check failed' });
		}
	}
}
