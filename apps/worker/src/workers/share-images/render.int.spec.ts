import { UnrecoverableError } from 'bullmq';
import puppeteer, { type Browser } from 'puppeteer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config from '#app/config.js';
import type { Storage } from '#lib/storage.js';
import { TrackedStorage } from '#app/workers/releases/testing.js';
import {
	MIN_FONT_SIZE,
	SHARE_HEIGHT,
	SHARE_WIDTH,
	renderShareImage
} from './render.js';

const HOARE =
	'There are two ways of constructing a software design: one way is to make it so simple that there are obviously no deficiencies, and the other way is to make it so complicated that there are no obvious deficiencies.';

/** Rendering with headless Chromium and uploading to the real bucket. */
describe('renderShareImage', () => {
	let browser: Browser;
	const storage = new TrackedStorage();
	const prefix = `share/test-${Date.now().toString(36)}`;

	beforeAll(async () => {
		browser = await puppeteer.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
			...(config.puppeteer.executablePath
				? { executablePath: config.puppeteer.executablePath }
				: {})
		});
	});
	afterAll(async () => {
		await browser.close();
		await storage.cleanUp();
	});

	/** RGB of a pixel of `png`, read back through the browser's canvas. */
	async function pixels(png: Buffer, points: [number, number][]) {
		const tab = await browser.newPage();
		try {
			return (await tab.evaluate(
				`(async () => {
					const img = new Image();
					img.src = 'data:image/png;base64,${png.toString('base64')}';
					await img.decode();
					const canvas = document.createElement('canvas');
					canvas.width = img.width;
					canvas.height = img.height;
					const ctx = canvas.getContext('2d');
					ctx.drawImage(img, 0, 0);
					return {
						size: [img.width, img.height],
						points: ${JSON.stringify(points)}.map(([x, y]) =>
							Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3)))
					};
				})()`
			)) as { size: [number, number]; points: number[][] };
		} finally {
			await tab.close();
		}
	}

	it('renders the quote card as the OgImage artboard: 1200×630, paper, clay edge', async () => {
		const key = `${prefix}/quote.png`;
		const result = await renderShareImage(browser, storage, {
			key,
			variant: 'quote',
			card: {
				id: 'q_8f2k1c',
				text: 'Simplicity is prerequisite for reliability.',
				author: 'Edsger W. Dijkstra'
			}
		});
		expect(result.fontSize).toBe(60); // the kit's size for a short quote

		const stored = await storage.fetch(key);
		expect(stored.contentType).toBe('image/png');
		expect(stored.cacheControl).toContain('immutable');
		const read = await pixels(stored.bytes, [
			[8, 300], // the 16px clay-500 edge
			[1150, 30] // paper
		]);
		expect(read.size).toEqual([SHARE_WIDTH, SHARE_HEIGHT]);
		expect(read.points).toEqual([
			[0xb8, 0x5c, 0x3e],
			[0xf4, 0xf2, 0xed]
		]);
	});

	it.each(['quote', 'terminal'] as const)(
		'fits Hoare’s 220 characters on the %s card without clipping',
		async (variant) => {
			const key = `${prefix}/hoare-${variant}.png`;
			const result = await renderShareImage(browser, storage, {
				key,
				variant,
				card: { id: 'q_0h5w3q', text: HOARE, author: 'C. A. R. Hoare' }
			});
			expect(result.fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
			const read = await pixels((await storage.fetch(key)).bytes, [[600, 20]]);
			expect(read.size).toEqual([SHARE_WIDTH, SHARE_HEIGHT]);
			// Ink ground for the terminal card, paper for the quote card.
			expect(read.points[0]).toEqual(
				variant === 'terminal' ? [0x14, 0x12, 0x10] : [0xf4, 0xf2, 0xed]
			);
		}
	);

	it('fails for good on a card that cannot fit', async () => {
		await expect(
			renderShareImage(browser, storage, {
				key: `${prefix}/never.png`,
				variant: 'terminal',
				card: { id: 'q_zzzzzz', text: 'word '.repeat(400), author: 'Nobody' }
			})
		).rejects.toBeInstanceOf(UnrecoverableError);
	});

	it('throws when the upload fails, so the job is retried', async () => {
		const failing: Storage = {
			put: () => Promise.reject(new Error('storage unavailable')),
			get: (key) => storage.get(key),
			delete: (key) => storage.delete(key)
		};
		await expect(
			renderShareImage(browser, failing, {
				key: `${prefix}/failed.png`,
				variant: 'quote',
				card: { id: 'q_8f2k1c', text: 'Short.', author: 'Someone' }
			})
		).rejects.toThrow('storage unavailable');
	});
});
