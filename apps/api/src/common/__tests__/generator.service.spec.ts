import { Test, TestingModule } from '@nestjs/testing';
import { faker as F } from '@faker-js/faker';
import moment from 'moment';
import { GeneratorService } from 'common/services';

describe('GeneratorService', () => {
	let service: GeneratorService;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [GeneratorService]
		}).compile();

		service = module.get(GeneratorService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('avatar', () => {
		it('should return avatar url based on name', () => {
			const name = `${F.person.firstName()} ${F.person.lastName()}`;
			const expectedSeed = name.toLowerCase().replace(' ', '+');
			const avatar = service.avatar(name);
			expect(avatar).toBe(
				`https://api.dicebear.com/7.x/initials/png?seed=${expectedSeed}%size=500`
			);
		});
	});

	describe('numeric', () => {
		it('should return an integer string of specified length', () => {
			const six = service.numeric(6);
			const ten = service.numeric(10);
			expect(six).toMatch(/^\d{6}$/);
			expect(ten).toMatch(/^\d{10}$/);
		});
	});

	describe('currentDate', () => {
		it('should return the current UTC date as YYYY-MM-DD', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-06-08T15:30:45.000Z'));
			expect(service.currentDate()).toBe('2026-06-08');
			vi.useRealTimers();
		});
	});

	describe('currentHour', () => {
		it('should return the current UTC hour bucket as YYYY-MM-DDTHH', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-06-08T15:30:45.000Z'));
			expect(service.currentHour()).toBe('2026-06-08T15');
			vi.useRealTimers();
		});
	});

	describe('addPrefix', () => {
		it('should join prefix and text with the default delimiter', () => {
			expect(service.addPrefix('sync', '2026-06-08T15')).toBe(
				'sync:2026-06-08T15'
			);
		});

		it('should honour a custom delimiter', () => {
			expect(service.addPrefix('sync', 'today', '/')).toBe('sync/today');
		});
	});

	describe('alphabet', () => {
		describe('when SIZE not provided', () => {
			it('should return a 128 character hex string (64 bytes)', () => {
				expect(service.alphabet()).toEqual(expect.any(String));
				expect(service.alphabet().length).toBe(128);
			});
		});

		describe('otherwise', () => {
			it('should return string of length [2 * SIZE]', () => {
				expect(service.alphabet(8).length).toBe(16);
				expect(service.alphabet(16).length).toBe(32);
				expect(service.alphabet(32).length).toBe(64);
			});
		});

		describe('uuid', () => {
			it('should return a valid UUID v4 string', () => {
				const id = service.uuid();
				const uuidV4Regex =
					/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
				expect(id).toMatch(uuidV4Regex);
			});
		});

		describe('now', () => {
			it('should return current UTC moment instance', () => {
				const now = service.now();
				expect(moment.isMoment(now)).toBe(true);
				expect(now.isUTC()).toBe(true);
			});
		});

		describe('expiry', () => {
			it('should return moment with added duration', () => {
				const base = service.now();
				const expiry = service.expiry(10, 'minutes');
				expect(moment.isMoment(expiry)).toBe(true);
				const diff = expiry.diff(base, 'minutes');
				expect(diff).toBe(10);
			});
		});
	});
});
