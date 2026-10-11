import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'common/services';
import { DATASET_VERSION, type RegisterDevice } from '../dto';
import type { DeviceEntity, DeviceListEntity } from '../entity';

const SELECT = {
	id: true,
	label: true,
	authorizedAt: true,
	lastSyncAt: true,
	datasetVersion: true,
	revokedAt: true
} as const;

@Injectable()
export class DevicesService {
	constructor(private db: PrismaService) {}

	/**
	 * Registers the terminal behind this session (the token `qotm login` got).
	 * Registering again from the same session relabels it, so a retried login
	 * never makes a second row. A dataset version the CLI reports is its first
	 * sync.
	 */
	register(
		userId: string,
		sessionId: string,
		input: RegisterDevice,
		datasetVersion?: string
	): Promise<DeviceEntity> {
		const synced = this.syncFields(datasetVersion);
		return this.db.device.upsert({
			where: { sessionId },
			create: { userId, sessionId, label: input.label, ...synced },
			update: { label: input.label, revokedAt: null, ...synced },
			select: SELECT
		});
	}

	/**
	 * `qotm logout`: revokes this terminal and ends its session, so the token
	 * stops working. The CLI keeps its local quotes and dataset.
	 */
	async logout(sessionId: string) {
		await this.db.$transaction([
			this.db.device.updateMany({
				where: { sessionId, revokedAt: null },
				data: { revokedAt: new Date() }
			}),
			this.db.session.deleteMany({ where: { id: sessionId } })
		]);
	}

	/** Settings › Terminals: every terminal the member signed in, newest first. */
	async list(
		userId: string,
		currentSessionId?: string
	): Promise<DeviceListEntity> {
		const rows = await this.db.device.findMany({
			where: { userId },
			orderBy: [
				{ revokedAt: { sort: 'desc', nulls: 'first' } },
				{ authorizedAt: 'desc' }
			],
			select: { ...SELECT, sessionId: true }
		});
		return {
			list: rows.map(({ sessionId, ...device }): DeviceEntity => ({
				...device,
				current: Boolean(currentSessionId) && sessionId === currentSessionId
			}))
		};
	}

	/**
	 * Revokes one of the member's terminals from Settings: it stops syncing
	 * the account (its token ends) and keeps its local quotes and dataset.
	 * Someone else's terminal is a 404.
	 */
	async revoke(userId: string, id: string) {
		const device = await this.db.device.findFirst({ where: { id, userId } });
		if (!device) throw new NotFoundException('Device not found');
		await this.db.$transaction([
			this.db.device.update({
				where: { id },
				data: { revokedAt: device.revokedAt ?? new Date() }
			}),
			this.db.session.deleteMany({
				where: { id: device.sessionId ?? '__none__' }
			})
		]);
	}

	/**
	 * Records a sync from the terminal behind this session (the CLI's
	 * `X-Qotm-Dataset` header). A session with no registered device, or a
	 * revoked one, records nothing.
	 */
	async recordSync(sessionId: string, datasetVersion?: string) {
		const synced = this.syncFields(datasetVersion);
		if (!synced.datasetVersion) return;
		await this.db.device.updateMany({
			where: { sessionId, revokedAt: null },
			data: synced
		});
	}

	private syncFields(datasetVersion?: string) {
		return datasetVersion && DATASET_VERSION.test(datasetVersion)
			? { datasetVersion, lastSyncAt: new Date() }
			: {};
	}
}
