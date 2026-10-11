import { TestBed, type Mocked } from '@suites/unit';
import { CacheService, LoggerService } from 'common/services';
import { DevicesService } from 'devices/services';
import { DatasetService, syncCounterKey } from '../services';

describe('DatasetService.recordSync', () => {
	let service: DatasetService;
	let cache: Mocked<CacheService>;
	let devices: Mocked<DevicesService>;
	let logger: Mocked<LoggerService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(DatasetService).compile();
		service = unit;
		cache = unitRef.get(CacheService);
		devices = unitRef.get(DevicesService);
		logger = unitRef.get(LoggerService);
	});

	it('counts the day’s syncs and records the terminal’s version', async () => {
		cache.incr.mockResolvedValue(1);
		devices.recordSync.mockResolvedValue(undefined);
		await service.recordSync('s1', 'v2026.09.1');
		expect(cache.incr).toHaveBeenCalledWith(
			syncCounterKey(new Date()),
			40 * 86_400
		);
		expect(devices.recordSync).toHaveBeenCalledWith('s1', 'v2026.09.1');
	});

	it('never rejects: a failed write is logged, not thrown at the request', async () => {
		cache.incr.mockRejectedValue(new Error('redis down'));
		await expect(
			service.recordSync(undefined, undefined)
		).resolves.toBeUndefined();
		expect(devices.recordSync).not.toHaveBeenCalled();
		expect(logger.warn).toHaveBeenCalled();
	});

	it('keys the counter by UTC day', () => {
		expect(syncCounterKey(new Date('2026-09-26T23:59:00Z'))).toBe(
			'dataset:syncs:2026-09-26'
		);
	});
});
