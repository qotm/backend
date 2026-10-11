import type { Job } from 'bullmq';
import config from '#app/config.js';
import { DB } from '#app/db.js';
import logger from '#app/logger.js';
import { S3Storage } from '#lib/storage.js';
import { createWorker } from '#utils/worker.js';
import { BUILD_PREVIEW, RELEASES_QUEUE } from '#app/workers/constants.js';
import { buildPreview, type ReleaseJob } from './build.js';

const storage = new S3Storage();

/**
 * Consumes `releases`. A failure throws, so the producer's attempts and
 * backoff apply; one that can never succeed (a published release) throws
 * UnrecoverableError and fails at once. Failed jobs stay in Bull Board
 * (/dashboard on the API).
 */
export const releases = createWorker<ReleaseJob>(
	RELEASES_QUEUE,
	async (job: Job<ReleaseJob>) => {
		if (job.name === BUILD_PREVIEW) {
			const result = await buildPreview(DB.instance, storage, job.data, {
				prefix: config.releases.prefix,
				baseUrl: config.releases.baseUrl
			});
			logger.info({ jobId: job.id, ...result }, 'Release preview built');
			return result;
		}
		throw new Error(`Unknown releases job: ${job.name}`);
	}
);
