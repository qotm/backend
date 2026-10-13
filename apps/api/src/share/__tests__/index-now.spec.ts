import { of, throwError } from 'rxjs';
import type { HttpService } from '@nestjs/axios';
import type { CustomConfigService, LoggerService } from 'common/services';
import { IndexNowService } from 'share/services';

describe('IndexNowService', () => {
	const make = (
		app: { indexNowKey: string; env: string },
		post = vi.fn(() => of({ status: 200 }))
	) => {
		const logger = { warn: vi.fn() };
		const service = new IndexNowService(
			{ post } as unknown as HttpService,
			{
				app: { frontendHost: 'https://qotm.site', ...app }
			} as unknown as CustomConfigService,
			logger as unknown as LoggerService
		);
		return { service, post, logger };
	};

	it("pings the quote's page with the key and where the web serves it", async () => {
		const { service, post } = make({
			indexNowKey: 'abcdef0123456789',
			env: 'production'
		});
		expect(await service.quote('q_8f2k1c')).toBe(true);
		expect(post).toHaveBeenCalledWith('https://api.indexnow.org/indexnow', {
			host: 'qotm.site',
			key: 'abcdef0123456789',
			keyLocation: 'https://qotm.site/abcdef0123456789.txt',
			urlList: ['https://qotm.site/q/8f2k1c']
		});
	});

	it.each([
		{ indexNowKey: '', env: 'production' },
		{ indexNowKey: 'abcdef0123456789', env: 'development' },
		{ indexNowKey: 'abcdef0123456789', env: 'test' }
	])('stays quiet without a key or outside production (%o)', async (app) => {
		const { service, post } = make(app);
		expect(await service.quote('q_8f2k1c')).toBe(false);
		expect(post).not.toHaveBeenCalled();
	});

	it('logs a failed ping and never throws', async () => {
		const { service, logger } = make(
			{ indexNowKey: 'abcdef0123456789', env: 'production' },
			vi.fn(() => throwError(() => new Error('429')))
		);
		expect(await service.quote('q_8f2k1c')).toBe(false);
		expect(logger.warn).toHaveBeenCalled();
	});
});
