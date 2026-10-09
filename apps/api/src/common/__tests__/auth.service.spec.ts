import { TestBed, type Mocked } from '@suites/unit';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { CustomAuthService } from 'common/services/auth.service';
import type { BetterAuth } from 'lib/auth';

describe('CustomAuthService', () => {
	let service: CustomAuthService;
	let auth: Mocked<AuthService<BetterAuth>>;

	beforeAll(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(CustomAuthService).compile();
		service = unit;
		auth = unitRef.get(AuthService<BetterAuth> as any);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should expose auth api getter', () => {
		const api = {} as any;
		auth.api = api;

		expect(service.api).toBe(api);
	});

	it('should expose auth instance getter', () => {
		expect(service.instance).toBe(auth);
	});
});
