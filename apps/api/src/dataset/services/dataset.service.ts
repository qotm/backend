import { Injectable, NotFoundException } from '@nestjs/common';
import { ReleaseState } from '@qotm/db/enums';
import {
	CacheService,
	CustomConfigService,
	LoggerService,
	PrismaService
} from 'common/services';
import { DevicesService } from 'devices/services';
import type { CurrentReleaseEntity, ManifestEntity } from '../entity';
import { DATASET_LICENSE } from '../license';

/** Syncs per UTC day, kept long enough for the dashboard's 30 days. */
export const syncCounterKey = (day: Date) =>
	`dataset:syncs:${day.toISOString().slice(0, 10)}`;
const SYNC_COUNTER_TTL = 40 * 86_400;

/**
 * The current dataset release for the CLI and the Curated page. "Current" is
 * the newest published release: publishing one (the worker, QOT-58) is what
 * flips every install to it on its next `qotm sync`.
 */
@Injectable()
export class DatasetService {
	constructor(
		private db: PrismaService,
		private cache: CacheService,
		private config: CustomConfigService,
		private devices: DevicesService,
		private logger: LoggerService
	) {}

	private async current() {
		const release = await this.db.release.findFirst({
			where: { state: ReleaseState.PUBLISHED, sha256: { not: null } },
			orderBy: { publishedAt: 'desc' }
		});
		if (!release) throw new NotFoundException('No dataset release yet');
		return release;
	}

	async manifest(): Promise<ManifestEntity> {
		const r = await this.current();
		return {
			version: r.version,
			schemaVersion: r.schemaVersion,
			publishedAt: r.publishedAt!,
			url: this.url(r.version),
			size: r.sizeBytes ?? 0,
			sha256: r.sha256!,
			changes: {
				eligible: r.eligibleCount,
				added: r.addedCount,
				corrected: r.correctedCount,
				withdrawn: r.withdrawnCount
			},
			license: DATASET_LICENSE
		};
	}

	async currentRelease(): Promise<CurrentReleaseEntity> {
		const r = await this.current();
		return {
			version: r.version,
			publishedAt: r.publishedAt!,
			schemaVersion: r.schemaVersion,
			quotes: r.eligibleCount,
			changes: {
				eligible: r.eligibleCount,
				added: r.addedCount,
				corrected: r.correctedCount,
				withdrawn: r.withdrawnCount
			}
		};
	}

	/** Where the current `qotm.sqlite` is served. */
	async downloadUrl() {
		return this.url((await this.current()).version);
	}

	/**
	 * Counts a sync for the dashboard, and records on the caller's terminal
	 * which version it holds. Not awaited by the request: a slow or failing
	 * write never delays or fails the manifest.
	 */
	recordSync(
		sessionId: string | undefined,
		datasetVersion: string | undefined
	) {
		const work = Promise.all([
			this.cache.incr(syncCounterKey(new Date()), SYNC_COUNTER_TTL),
			sessionId
				? this.devices.recordSync(sessionId, datasetVersion)
				: Promise.resolve()
		]).catch((error: unknown) =>
			this.logger.warn({ error }, 'Could not record a dataset sync')
		);
		return work;
	}

	private url(version: string) {
		return `${this.config.releases.baseUrl}/${version}/qotm.sqlite`;
	}
}
