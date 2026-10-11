import type { Job } from 'bullmq';
import { DB } from '#app/db.js';
import logger from '#app/logger.js';
import { createWorker } from '#utils/worker.js';
import {
	CHECK_ORIGINALITY,
	MATCHING_QUEUE,
	RECHECK_ORIGINALS
} from '#app/workers/constants.js';
import { checkOriginality, recheckOriginals } from './check.js';

/** As the API enqueues it (SubmissionsService.queueCheck). */
type MatchingJob = { quoteId: string } | Record<string, never>;

/**
 * Consumes `matching`. Errors are thrown so the producer's attempts and
 * backoff apply; a job that keeps failing stays failed in Bull Board
 * (/dashboard on the API).
 */
export const matching = createWorker<MatchingJob>(
	MATCHING_QUEUE,
	async (job: Job<MatchingJob>) => {
		if (job.name === CHECK_ORIGINALITY && 'quoteId' in job.data) {
			const result = await checkOriginality(DB.instance, job.data.quoteId);
			logger.info(
				{ jobId: job.id, quoteId: job.data.quoteId, ...result },
				'Originality check'
			);
			return result;
		}
		if (job.name === RECHECK_ORIGINALS) {
			const result = await recheckOriginals(DB.instance);
			logger.info({ jobId: job.id, ...result }, 'Nightly originality re-check');
			return result;
		}
		throw new Error(`Unknown matching job: ${job.name}`);
	}
);
