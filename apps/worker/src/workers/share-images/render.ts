import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UnrecoverableError } from 'bullmq';
import type { Browser } from 'puppeteer';
import { IMMUTABLE, type Storage } from '#lib/storage.js';

export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;
/** Below this the quote is no longer a share card; it cannot happen within 280 characters. */
export const MIN_FONT_SIZE = 24;

export interface ShareCard {
	id: string;
	text: string;
	author: string;
}

/** As the API enqueues it (`apps/api/src/share/jobs.ts`, RenderShareImage). */
export interface RenderShareImage {
	key: string;
	variant: 'quote' | 'terminal';
	card: ShareCard;
}

const here = dirname(fileURLToPath(import.meta.url));
// src/workers/share-images (dev) and dist/src/workers/share-images (build)
// both sit under apps/worker; the assets are at its root.
const assets = join(
	here,
	here.includes('/dist/') ? '../../../../assets/share' : '../../../assets/share'
);
const require = createRequire(import.meta.url);
const font = (file: string) =>
	readFileSync(require.resolve(file)).toString('base64');

let template: string | undefined;

/**
 * A page that renders qotm_kit's ShareCard at 1200×630, full bleed, with
 * the fonts inlined (self-hosted: no request leaves the page).
 */
function page() {
	template ??= `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Space Grotesk"; font-weight: 600; font-display: block;
	src: url(data:font/woff2;base64,${font('@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff2')}) format("woff2"); }
@font-face { font-family: "Space Grotesk"; font-weight: 600; font-display: block;
	src: url(data:font/woff2;base64,${font('@fontsource/space-grotesk/files/space-grotesk-latin-ext-600-normal.woff2')}) format("woff2");
	unicode-range: U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: "JetBrains Mono"; font-weight: 400; font-display: block;
	src: url(data:font/woff2;base64,${font('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2')}) format("woff2"); }
${readFileSync(join(assets, 'tokens.css'), 'utf8')}
${readFileSync(join(assets, 'qotm-kit.css'), 'utf8')}
html, body { margin: 0; width: ${SHARE_WIDTH}px; height: ${SHARE_HEIGHT}px; overflow: hidden; }
.qk-share-wrap { border: 0; border-radius: 0; }
.qk-share__cursor { animation: none; }
</style>
<script>${readFileSync(join(assets, 'react.production.min.js'), 'utf8')}</script>
<script>${readFileSync(join(assets, 'react-dom.production.min.js'), 'utf8')}</script>
<script>${readFileSync(join(assets, 'qotm-kit.js'), 'utf8')}</script>
<script>${readFileSync(join(assets, 'render.js'), 'utf8')}</script>
</head><body><div id="root"></div></body></html>`;
	return template;
}

/**
 * Renders the card and returns the PNG and the quote's final font size.
 * The kit sizes the quote by length (60, 50 or 42px); a quote that still
 * overflows (Hoare's 220 characters on the terminal card) is stepped down
 * until the credit clears the footer, so nothing is ever clipped.
 */
export async function renderCard(
	browser: Browser,
	variant: RenderShareImage['variant'],
	card: ShareCard
) {
	const tab = await browser.newPage();
	try {
		await tab.setViewport({
			width: SHARE_WIDTH,
			height: SHARE_HEIGHT,
			deviceScaleFactor: 1
		});
		await tab.setContent(page(), { waitUntil: 'load' });
		const fontSize = (await tab.evaluate(
			`window.renderShareCard(${JSON.stringify(variant)}, ${JSON.stringify(card)}, ${SHARE_HEIGHT}, ${MIN_FONT_SIZE})`
		)) as number | null;
		if (fontSize === null) {
			throw new UnrecoverableError(
				`Quote ${card.id} does not fit the ${variant} card`
			);
		}
		const png = await tab.screenshot({
			type: 'png',
			clip: { x: 0, y: 0, width: SHARE_WIDTH, height: SHARE_HEIGHT }
		});
		return { png: Buffer.from(png), fontSize };
	} finally {
		await tab.close();
	}
}

/**
 * The `share-images` job (BUILD-PLAN §6, QOT-51): renders the card and
 * uploads it to the key the API chose. The key carries the card's revision,
 * so the object never changes and is cached for a year.
 */
export async function renderShareImage(
	browser: Browser,
	storage: Storage,
	job: RenderShareImage
) {
	const { png, fontSize } = await renderCard(browser, job.variant, job.card);
	await storage.put(job.key, png, {
		contentType: 'image/png',
		cacheControl: IMMUTABLE,
		public: true
	});
	return { key: job.key, bytes: png.length, fontSize };
}
