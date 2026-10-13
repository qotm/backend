import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { PageCard, ShareCard, ShareVariant } from './cards';

/**
 * The `share-images` queue, consumed by the worker
 * (`apps/worker/src/workers/share-images/`). Names must match its
 * `src/workers/constants.ts`.
 */
export const SHARE_IMAGES_QUEUE = 'share-images';
export const RENDER_SHARE_IMAGE = 'render-share-image';

export type RenderShareImage =
	| {
			/** Where the PNG goes: `share/<id>/<variant>-<revision>.png`. */
			key: string;
			variant: ShareVariant;
			card: ShareCard;
	  }
	| {
			/** `og/<kind>s/<slug>-<revision>.png`, `og/site-<revision>.png`. */
			key: string;
			variant: 'page';
			card: PageCard;
	  };

/** Someone is waiting for it (an unfurl, the Share dialog). */
export const NOW = 'now';
/** Drawn ahead of time: after a decision, or by the backfill. */
export const AHEAD = 'ahead';
export type Urgency = typeof NOW | typeof AHEAD;

@Injectable()
export class ShareImageJobs {
	constructor(@InjectQueue(SHARE_IMAGES_QUEUE) private queue: Queue) {}

	/**
	 * Queues a render (`AHEAD` ones after every `NOW` one). Requests for the same image while one is queued or
	 * running are dropped (deduplicated by key); a failed render is kept in
	 * Bull Board and the next request queues it again.
	 */
	async render(data: RenderShareImage, urgency: Urgency = NOW) {
		const jobId = `render-${randomUUID()}`;
		const job = await this.queue.add(RENDER_SHARE_IMAGE, data, {
			jobId,
			// BullMQ takes unprioritised jobs first, so a waiting unfurl never
			// queues behind a backfill of thousands.
			...(urgency === AHEAD ? { priority: 10 } : {}),
			deduplication: { id: data.key },
			attempts: 3,
			backoff: { type: 'exponential', delay: 15_000 },
			removeOnComplete: 1000,
			removeOnFail: 1000
		});
		if (job.id === jobId) return true;
		// Already queued, perhaps by the backfill: someone waits for it now.
		if (urgency === NOW && job.id) {
			const queued = await this.queue.getJob(job.id);
			if (queued && (await queued.getState()) === 'prioritized') {
				await queued.changePriority({ priority: 0 }).catch(() => undefined);
			}
		}
		return false;
	}
}
