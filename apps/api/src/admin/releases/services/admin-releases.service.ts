import {
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common';
import type { Prisma } from '@qotm/db/client';
import { ReleaseState } from '@qotm/db/enums';
import type { AuditEntry } from 'audit';
import { PrismaService } from 'common/services';
import { DATASET_SCHEMA_VERSION, ReleaseJobs, openRelease } from 'releases';
import type { ReleaseListQuery } from '../dto';
import type {
	AdminReleaseEntity,
	AdminReleasesEntity,
	ReleaseJobEntity
} from '../entity';

type Actor = NonNullable<AuditEntry['actor']>;

const WITH_PUBLISHER = {
	publishedBy: { select: { handle: true } }
} satisfies Prisma.ReleaseInclude;
type ReleaseRow = Prisma.ReleaseGetPayload<{ include: typeof WITH_PUBLISHER }>;

function toRelease(r: ReleaseRow): AdminReleaseEntity {
	return {
		version: r.version,
		state: r.state,
		schemaVersion: r.schemaVersion,
		eligible: r.eligibleCount,
		added: r.addedCount,
		corrected: r.correctedCount,
		withdrawn: r.withdrawnCount,
		changes: `+${r.addedCount} ~${r.correctedCount} −${r.withdrawnCount}`,
		sizeBytes: r.sizeBytes,
		sha256: r.sha256,
		previewBuiltAt: r.previewBuiltAt,
		publishedAt: r.publishedAt,
		publishedBy: r.publishedBy
	};
}

/**
 * Admin › Dataset releases (BUILD-PLAN §5, §6). The API assigns the version
 * and queues the work; the worker builds the preview and publishes it
 * (QOT-50, QOT-58), auditing each.
 */
@Injectable()
export class AdminReleasesService {
	constructor(
		private db: PrismaService,
		private jobs: ReleaseJobs
	) {}

	async list(query: ReleaseListQuery): Promise<AdminReleasesEntity> {
		const [current, building, [list, meta]] = await Promise.all([
			this.db.release.findFirst({
				where: { state: { not: ReleaseState.PUBLISHED } },
				orderBy: { createdAt: 'desc' },
				include: WITH_PUBLISHER
			}),
			this.jobs.building(),
			this.db.x.release.paginate({
				where: { state: ReleaseState.PUBLISHED },
				orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
				include: WITH_PUBLISHER,
				page: query.page,
				limit: query.limit
			})
		]);
		return {
			current: current ? toRelease(current) : null,
			building,
			list: (list as ReleaseRow[]).map(toRelease),
			...meta
		};
	}

	/**
	 * Queues a preview of the release not yet published, opening one with
	 * the next version if there is none. One build at a time: 409 while one
	 * is waiting or running.
	 */
	async preview(actor: Actor): Promise<ReleaseJobEntity> {
		if (await this.jobs.building()) throw this.busy();
		const release = await openRelease(this.db, DATASET_SCHEMA_VERSION);
		if (!(await this.jobs.preview({ releaseId: release.id, actor }))) {
			throw this.busy();
		}
		return { release: await this.get(release.version), queued: true };
	}

	/**
	 * Queues the publish of a built preview, once the admin has confirmed
	 * reviewing it (the DTO requires the tick). Refused while a build is in
	 * flight, since it would replace the file being published.
	 */
	async publish(version: string, actor: Actor): Promise<ReleaseJobEntity> {
		const release = await this.get(version);
		if (release.state === ReleaseState.PUBLISHED) {
			throw new ConflictException(`Release ${version} is already published`);
		}
		if (release.state !== ReleaseState.PREVIEW || !release.sha256) {
			throw new ConflictException(
				`Release ${version} has no preview build to publish yet`
			);
		}
		if (await this.jobs.building()) throw this.busy();
		const row = await this.db.release.findUniqueOrThrow({
			where: { version }
		});
		if (!(await this.jobs.publish({ releaseId: row.id, actor }))) {
			throw new ConflictException(
				`Release ${version} is already being published`
			);
		}
		return { release, queued: true };
	}

	private async get(version: string) {
		const release = await this.db.release.findUnique({
			where: { version },
			include: WITH_PUBLISHER
		});
		if (!release) throw new NotFoundException('Release not found');
		return toRelease(release);
	}

	private busy() {
		return new ConflictException(
			'A preview build is already running; try again when it finishes'
		);
	}
}
