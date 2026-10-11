import { randomInt } from 'crypto';
import {
	CLI_CLIENT_ID,
	deviceAuthorizationOptions,
	generateUserCode
} from 'lib/sign-in';
import { DevicesService } from 'devices/services';

describe('generateUserCode', () => {
	it('makes QTM codes from characters nobody misreads', () => {
		for (let i = 0; i < 500; i++) {
			expect(generateUserCode(randomInt)).toMatch(/^QTM-[A-HJ-NP-Z2-9]{4}$/);
		}
	});
});

describe('deviceAuthorizationOptions', () => {
	const options = deviceAuthorizationOptions('https://qotm.dev/', randomInt);

	it('follows the CLI contract: 15 minutes, every 5 seconds, approved at /device', () => {
		expect(options).toMatchObject({
			expiresIn: '15m',
			interval: '5s',
			verificationUri: 'https://qotm.dev/device'
		});
	});

	it('serves the qotm CLI only', () => {
		expect(options.validateClient(CLI_CLIENT_ID)).toBe(true);
		expect(options.validateClient('other')).toBe(false);
	});
});

describe('DevicesService.recordSync', () => {
	function service() {
		const updateMany = vi.fn(async () => ({ count: 1 }));
		return {
			svc: new DevicesService({ device: { updateMany } } as never),
			updateMany
		};
	}

	it('records a well-formed dataset version on the live device', async () => {
		const { svc, updateMany } = service();
		await svc.recordSync('s1', 'v2026.08.3');
		expect(updateMany).toHaveBeenCalledWith({
			where: { sessionId: 's1', revokedAt: null },
			data: { datasetVersion: 'v2026.08.3', lastSyncAt: expect.any(Date) }
		});
	});

	it.each([undefined, '', 'latest', 'v2026.8.3', 'v2026.08.3; drop'])(
		'ignores %j',
		async (version) => {
			const { svc, updateMany } = service();
			await svc.recordSync('s1', version as string | undefined);
			expect(updateMany).not.toHaveBeenCalled();
		}
	);
});
