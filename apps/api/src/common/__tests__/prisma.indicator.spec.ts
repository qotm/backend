import { TestBed, type Mocked } from '@suites/unit';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from 'common/misc/prisma.indicator';
import { PrismaService } from 'common/services';

describe('PrismaHealthIndicator', () => {
	let indicator: PrismaHealthIndicator;
	let db: Mocked<PrismaService>;

	beforeAll(async () => {
		const { unit, unitRef } = await TestBed.sociable(PrismaHealthIndicator)
			.expose(HealthIndicatorService)
			.compile();
		indicator = unit;
		db = unitRef.get(PrismaService);
	});

	it('should be defined', () => {
		expect(indicator).toBeDefined();
	});

	it('should return healthy status when query succeeds', async () => {
		db.$queryRawUnsafe.mockResolvedValue(1);

		const result = await indicator.isHealthy('database');
		expect(db.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
		expect(result).toBeDefined();
		expect(result).toEqual({ database: { status: 'up' } });
	});

	it('should return down status when query fails', async () => {
		db.$queryRawUnsafe.mockRejectedValue(new Error('fail'));

		const result = await indicator.isHealthy('database');
		expect(result).toEqual({
			database: { status: 'down', message: 'Database check failed' }
		});
	});
});
