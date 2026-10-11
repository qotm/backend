import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'common/services';

/**
 * How long an expired device code is kept: a CLI still polling within this
 * time gets `expired_token`; after it, the code is gone and it gets
 * `invalid_grant`, which the CLI treats the same way.
 */
export const DEVICE_CODE_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Clears what sign-in leaves behind (BUILD-PLAN §6): expired device codes
 * (`qotm login`) and unused magic links that have expired. Both are already
 * refused by better-auth once expired; this only stops them piling up.
 * Idempotent: a second run in the same hour deletes nothing.
 */
@Injectable()
export class AuthMaintenanceService {
	private readonly logger = new Logger(AuthMaintenanceService.name);

	constructor(private db: PrismaService) {}

	@Cron(CronExpression.EVERY_HOUR, { name: 'auth-maintenance' })
	async run() {
		const removed = await this.purge();
		if (removed.deviceCodes || removed.magicLinks) {
			this.logger.log(removed, 'Cleared expired sign-in codes');
		}
	}

	async purge(now = new Date()) {
		const [deviceCodes, magicLinks] = await this.db.$transaction([
			this.db.deviceCode.deleteMany({
				where: {
					expiresAt: { lt: new Date(now.getTime() - DEVICE_CODE_GRACE_MS) }
				}
			}),
			this.db.verification.deleteMany({
				where: {
					identifier: { startsWith: 'magic-link:' },
					expiresAt: { lt: now }
				}
			})
		]);
		return { deviceCodes: deviceCodes.count, magicLinks: magicLinks.count };
	}
}
