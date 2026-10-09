import type { Job } from 'bullmq';
import logger from '#app/logger.js';
import { createWorker } from '#utils/worker.js';
import { EXAMPLE_QUEUE } from '#app/workers/constants.js';

type ExampleJob = { id: string };

/**
 * Workers are created with `autorun: false` and started explicitly from
 * `src/index.ts`, so nothing begins consuming while the process is still wiring
 * itself up.
 */
export const example = createWorker<ExampleJob>(
	EXAMPLE_QUEUE,
	async (job: Job<ExampleJob>) => {
		logger.info({ jobId: job.id, data: job.data }, 'Processing job');

		// Do the work here. Throwing marks the job failed and lets BullMQ retry it
		// according to the producer's attempts/backoff settings — so throw on a
		// genuine failure rather than swallowing it and returning normally.

		// Report progress as the work advances; the dashboard and producers see it.
		await job.updateProgress(100);

		return { ok: true };
	}
);
