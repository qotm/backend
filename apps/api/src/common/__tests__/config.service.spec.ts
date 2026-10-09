import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Config from 'common/services/config.service';
import { CustomConfigService } from 'common/services';

describe('ConfigService', () => {
	/*
	 * Keys only — do NOT compare against this snapshot.
	 *
	 * `ConfigModule.forRoot()` defaults to reading `.env`, so a test run (which
	 * `dotenv -e .env.test` has already loaded) picks up any dev-only variable
	 * `.env.test` doesn't define — dotenv won't overwrite what's already set, but
	 * it will add what's missing. This snapshot is taken before that happens, so
	 * comparing against it fails on exactly those variables. It surfaced as
	 * `cookiePrefix: '' !== 'zorinwess'` once BETTER_AUTH_COOKIE_PREFIX landed in
	 * `.env` alone.
	 *
	 * Both env files are gitignored, so the fix can't live in them: read the
	 * config again at assertion time instead, when both sides see one process.env.
	 */
	const values = Config.getVariables();
	let service: CustomConfigService;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({
					load: [Config.getVariables],
					validationSchema: Config.schema
				})
			],
			providers: [CustomConfigService, ConfigService]
		}).compile();
		service = module.get(CustomConfigService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe.each(Object.keys(values))('%s', (key) => {
		if (['app', 'cloudinary'].includes(key)) {
			it('should be defined', () => {
				expect(service[key]).toBeDefined();
			});
		} else {
			it('should be defined', () => {
				expect(service[key]).toBeDefined();
			});
			it('should return the correct environment values', () => {
				// Re-read rather than using the module-scope snapshot — see above.
				expect(service[key]).toStrictEqual(Config.getVariables()[key]);
			});
		}
	});
});
