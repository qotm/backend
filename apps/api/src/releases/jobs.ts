import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { AuditEntry } from 'audit';
import { FAILED_JOBS_KEPT } from 'common/constants/jobs';

/**
 * The `releases` queue, consumed by the worker
 * (`apps/worker/src/workers/releases/`). Names must match its
 * `src/workers/constants.ts`.
 */
export const RELEASES_QUEUE = 'releases';
export const BUILD_PREVIEW = 'build-preview';
export const PUBLISH_RELEASE = 'publish-release';

/** One release build at a time, across every release (QOT-46). */
export const BUILD_DEDUPLICATION_ID = 'release-build';

export interface ReleaseJobData {
	releaseId: string;
	actor: AuditEntry['actor'];
}

@Injectable()
export class ReleaseJobs {
	constructor(@InjectQueue(RELEASES_QUEUE) private queue: Queue) {}

	/**
	 * Queues a preview build, unless one is already waiting or running
	 * (BullMQ deduplication: the new job is dropped and false is returned).
	 * The job is retried with backoff; failed ones stay in Bull Board for
	 * 30 days.
	 */
	async preview(data: ReleaseJobData) {
		const jobId = `preview-${data.releaseId}-${randomUUID()}`;
		const job = await this.queue.add(BUILD_PREVIEW, data, {
			jobId,
			deduplication: { id: BUILD_DEDUPLICATION_ID },
			attempts: 3,
			backoff: { type: 'exponential', delay: 30_000 },
			removeOnComplete: true,
			removeOnFail: FAILED_JOBS_KEPT
		});
		// A deduplicated add hands back the job already in flight.
		return job.id === jobId;
	}

	/** Whether a build is waiting or running. */
	async building() {
		return Boolean(
			await this.queue.getDeduplicationJobId(BUILD_DEDUPLICATION_ID)
		);
	}

	/**
	 * Queues a release's publish. The worker's job is idempotent, so it is
	 * retried freely; a second request while one is queued is dropped.
	 */
	async publish(data: ReleaseJobData) {
		const jobId = `publish-${data.releaseId}-${randomUUID()}`;
		const job = await this.queue.add(PUBLISH_RELEASE, data, {
			jobId,
			deduplication: { id: `release-publish-${data.releaseId}` },
			attempts: 5,
			backoff: { type: 'exponential', delay: 10_000 },
			removeOnComplete: true,
			removeOnFail: FAILED_JOBS_KEPT
		});
		return job.id === jobId;
	}
}

/**
 * The `qotm.sqlite` schema version the worker builds
 * (`apps/worker/src/dataset/schema.ts`, SCHEMA_VERSION); keep in step.
 */
export const DATASET_SCHEMA_VERSION = 1;
