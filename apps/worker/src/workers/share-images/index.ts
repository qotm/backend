import type { Job } from 'bullmq';
import type { Browser } from 'puppeteer';
import logger from '#app/logger.js';
import { S3Storage } from '#lib/storage.js';
import { launchBrowser } from '#utils/browser.js';
import { createWorker } from '#utils/worker.js';
import {
	RENDER_SHARE_IMAGE,
	SHARE_IMAGES_QUEUE
} from '#app/workers/constants.js';
import { renderShareImage, type RenderShareImage } from './render.js';

const storage = new S3Storage();

// One Chromium for every render, launched on the first job and relaunched if
// it dies; closed on shutdown.
let browser: Promise<Browser> | undefined;
async function chromium() {
	const current = browser ? await browser : undefined;
	if (current?.connected) return current;
	browser = launchBrowser();
	return browser;
}

export async function closeChromium() {
	if (browser) await (await browser).close();
}

/**
 * Consumes `share-images`. A failure throws, so the producer's attempts and
 * backoff apply; a card that can never fit throws UnrecoverableError. Failed
 * jobs stay in Bull Board (/dashboard on the API).
 */
export const shareImages = createWorker<RenderShareImage>(
	SHARE_IMAGES_QUEUE,
	async (job: Job<RenderShareImage>) => {
		if (job.name !== RENDER_SHARE_IMAGE) {
			throw new Error(`Unknown share-images job: ${job.name}`);
		}
		const result = await renderShareImage(await chromium(), storage, job.data);
		logger.info({ jobId: job.id, ...result }, 'Share image rendered');
		return result;
	}
);
