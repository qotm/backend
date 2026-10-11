import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { AppFactory } from '@test/factory/app';
import { AuthMaintenanceService, DEVICE_CODE_GRACE_MS } from 'devices/services';

/** The hourly clean-up of sign-in codes, against the real test database. */
describe('Auth maintenance', () => {
	let app: AppFactory;
	let service: AuthMaintenanceService;
	const now = new Date('2026-10-11T12:00:00Z');
	const ago = (ms: number) => new Date(now.getTime() - ms);
	const HOUR = 60 * 60 * 1000;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		service = app.instance.get(AuthMaintenanceService);

		const code = (id: string, expiresAt: Date) => ({
			id,
			deviceCode: `dc-${id}`,
			userCode: `QTM-${id}`,
			expiresAt,
			status: 'pending'
		});
		await app.db.deviceCode.createMany({
			data: [
				code('OLD1', ago(DEVICE_CODE_GRACE_MS + HOUR)),
				code('RCNT', ago(HOUR)),
				code('LIVE', new Date(now.getTime() + 10 * 60_000))
			]
		});
		const verification = (id: string, identifier: string, expiresAt: Date) => ({
			id,
			identifier,
			value: '{}',
			expiresAt
		});
		await app.db.verification.createMany({
			data: [
				verification('ml-old', 'magic-link:old', ago(HOUR)),
				verification(
					'ml-live',
					'magic-link:live',
					new Date(now.getTime() + 5 * 60_000)
				),
				verification('other-old', 'email-verification:x', ago(HOUR))
			]
		});
	});

	afterAll(async () => {
		await app.close();
	});

	it('deletes long-expired device codes and expired magic links, nothing else', async () => {
		expect(await service.purge(now)).toEqual({ deviceCodes: 1, magicLinks: 1 });

		const codes = (
			await app.db.deviceCode.findMany({ select: { id: true } })
		).map((c) => c.id);
		expect(codes.sort()).toEqual(['LIVE', 'RCNT']);
		const kept = (
			await app.db.verification.findMany({ select: { id: true } })
		).map((v) => v.id);
		expect(kept.sort()).toEqual(['ml-live', 'other-old']);
	});

	it('is idempotent', async () => {
		expect(await service.purge(now)).toEqual({ deviceCodes: 0, magicLinks: 0 });
	});

	it('runs hourly', () => {
		const job = app.instance
			.get(SchedulerRegistry)
			.getCronJob('auth-maintenance');
		expect(job.cronTime.source).toBe(CronExpression.EVERY_HOUR);
	});
});
