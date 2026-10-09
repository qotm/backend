import { TestBed, type Mocked } from '@suites/unit';
import {
	HealthCheckService,
	HttpHealthIndicator,
	DiskHealthIndicator,
	MemoryHealthIndicator
} from '@nestjs/terminus';
import { HealthController } from 'common/controllers/health.controller';
import { PrismaHealthIndicator } from 'common/misc/prisma.indicator';
import { CustomConfigService } from 'common/services';

describe('HealthController', () => {
	let controller: HealthController;
	let health: Mocked<HealthCheckService>;
	let http: Mocked<HttpHealthIndicator>;
	let prisma: Mocked<PrismaHealthIndicator>;
	let disk: Mocked<DiskHealthIndicator>;
	let memory: Mocked<MemoryHealthIndicator>;
	let config: Mocked<CustomConfigService>;

	beforeAll(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(HealthController).compile();
		controller = unit;
		health = unitRef.get(HealthCheckService);
		http = unitRef.get(HttpHealthIndicator);
		prisma = unitRef.get(PrismaHealthIndicator);
		disk = unitRef.get(DiskHealthIndicator);
		memory = unitRef.get(MemoryHealthIndicator);
		config = unitRef.get(CustomConfigService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	it('should delegate to HealthCheckService.check with proper indicators', async () => {
		config.app = { host: 'http://localhost:5000' } as any;
		// Non-default values, so the assertions prove config reaches the checks.
		config.health = {
			heapMaxMb: 512,
			rssMaxMb: 768,
			diskThreshold: 0.9,
			diskPath: '/data'
		};
		health.check.mockImplementation(async (fns) => {
			for (const fn of fns) {
				if (typeof fn === 'function') await fn();
			}
			return { status: 'ok' } as any;
		});
		http.pingCheck.mockResolvedValue({} as any);
		prisma.isHealthy.mockResolvedValue({} as any);
		memory.checkHeap.mockResolvedValue({} as any);
		memory.checkRSS.mockResolvedValue({} as any);
		disk.checkStorage.mockResolvedValue({} as any);

		const result = await controller.check();

		expect(health.check).toHaveBeenCalled();
		expect(http.pingCheck).toHaveBeenCalledWith('http', config.app.host);
		expect(prisma.isHealthy).toHaveBeenCalledWith('database');
		const MB = 1024 * 1024;
		expect(memory.checkHeap).toHaveBeenCalledWith('memory_heap', 512 * MB);
		expect(memory.checkRSS).toHaveBeenCalledWith('memory_rss', 768 * MB);
		expect(disk.checkStorage).toHaveBeenCalledWith('disk_storage', {
			thresholdPercent: 0.9,
			path: '/data'
		});
		expect(result).toEqual({ status: 'ok' });
	});
});
