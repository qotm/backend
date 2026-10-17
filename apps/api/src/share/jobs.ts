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
		const opts = options(data, urgency);
		const job = await this.queue.add(RENDER_SHARE_IMAGE, data, opts);
		if (job.id === opts.jobId) return true;
		// Already queued, perhaps by the backfill: someone waits for it now.
		if (urgency === NOW && job.id) {
			const queued = await this.queue.getJob(job.id);
			if (queued && (await queued.getState()) === 'prioritized') {
				await queued.changePriority({ priority: 0 }).catch(() => undefined);
			}
		}
		return false;
	}

	/** Queues many renders drawn ahead in one round trip (images that cannot be drawn yet: their card just changed). */
	async renderAll(data: RenderShareImage[]) {
		if (!data.length) return;
		await this.queue.addBulk(
			data.map((d) => ({
				name: RENDER_SHARE_IMAGE,
				data: d,
				opts: options(d, AHEAD)
			}))
		);
	}
}

const options = (data: RenderShareImage, urgency: Urgency) => ({
	jobId: `render-${randomUUID()}`,
	// BullMQ takes unprioritised jobs first, so a waiting unfurl never
	// queues behind a backfill of thousands.
	...(urgency === AHEAD ? { priority: 10 } : {}),
	deduplication: { id: data.key },
	attempts: 3,
	backoff: { type: 'exponential' as const, delay: 15_000 },
	removeOnComplete: true,
	removeOnFail: 1000
});
