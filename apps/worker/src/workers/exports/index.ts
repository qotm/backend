import type { Job } from 'bullmq';
import { DB } from '#app/db.js';
import logger from '#app/logger.js';
import { S3Storage } from '#lib/storage.js';
import { createWorker } from '#utils/worker.js';
import { EXPORTS_QUEUE, EXPORT_QUOTES } from '#app/workers/constants.js';
import { exportQuotes, type ExportQuotesJob } from './export.js';

const storage = new S3Storage();

/** Where exports go in the bucket: private, served by the API only. */
export const EXPORTS_PREFIX = 'exports';

/**
 * Consumes `exports`. A failure throws, so the producer's attempts and
 * backoff apply; failed jobs stay in Bull Board (/dashboard on the API).
 * The result ({ key, rows, bytes }) is what the API's download reads.
 */
export const csvExports = createWorker<ExportQuotesJob>(
	EXPORTS_QUEUE,
	async (job: Job<ExportQuotesJob>) => {
		if (job.name !== EXPORT_QUOTES) {
			throw new Error(`Unknown exports job: ${job.name}`);
		}
		const result = await exportQuotes(DB.instance, storage, job.id!, job.data, {
			prefix: EXPORTS_PREFIX
		});
		logger.info({ jobId: job.id, ...result }, 'Quotes exported');
		return result;
	}
);
