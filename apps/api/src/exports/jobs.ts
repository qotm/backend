import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { AdminQuoteFilters } from 'admin/quotes/dto';

/**
 * The `exports` queue, consumed by the worker
 * (`apps/worker/src/workers/exports/`). Names must match its
 * `src/workers/constants.ts`.
 */
export const EXPORTS_QUEUE = 'exports';
export const EXPORT_QUOTES = 'export-quotes';

/** How long a finished export can be fetched. */
export const EXPORT_TTL_SECONDS = 7 * 86_400;

export interface ExportQuotesJob {
	filters: AdminQuoteFilters;
	/** Only this admin may download the file. */
	requestedBy: { id: string; handle: string };
}

@Injectable()
export class ExportJobs {
	constructor(@InjectQueue(EXPORTS_QUEUE) private queue: Queue) {}

	/** Queues a CSV export of the admin quote list; returns its id. */
	async quotes(data: ExportQuotesJob) {
		const job = await this.queue.add(EXPORT_QUOTES, data, {
			jobId: `export-${randomUUID()}`,
			attempts: 3,
			backoff: { type: 'exponential', delay: 10_000 },
			removeOnComplete: { age: EXPORT_TTL_SECONDS },
			removeOnFail: false
		});
		return job.id!;
	}

	find(id: string) {
		return this.queue.getJob(id);
	}
}
