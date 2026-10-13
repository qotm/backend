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
/** The terminal card's one size starts by length (as the web's ShareCard) and steps down to this. */
export const MIN_TERMINAL_SIZE = 20;
const terminalStart = (text: string) => (text.length <= 60 ? 42 : text.length <= 120 ? 36 : 30);
/** A page card's title steps down to this; an 80-character author credit fits well above it. */
export const MIN_TITLE_SIZE = 40;

export interface ShareCard {
	id: string;
	text: string;
	author: string;
}

/** An author's, topic's or the site's og:image (`apps/api/src/share/cards.ts`, PageCard). */
export interface PageCard {
	kind: 'author' | 'topic' | 'site';
	path: string;
	eyebrow: string;
	title: string;
	line: string | null;
	quote: { text: string; author: string } | null;
}

/** As the API enqueues it (`apps/api/src/share/jobs.ts`, RenderShareImage). */
export type RenderShareImage =
	| { key: string; variant: 'quote' | 'terminal'; card: ShareCard }
	| { key: string; variant: 'page'; card: PageCard };

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
@font-face { font-family: "JetBrains Mono"; font-weight: 700; font-display: block;
	src: url(data:font/woff2;base64,${font('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2')}) format("woff2"); }
${readFileSync(join(assets, 'tokens.css'), 'utf8')}
${readFileSync(join(assets, 'qotm-kit.css'), 'utf8')}
html, body { margin: 0; width: ${SHARE_WIDTH}px; height: ${SHARE_HEIGHT}px; overflow: hidden; }
.qk-share-wrap { border: 0; border-radius: 0; }
.qk-share__cursor { animation: none; }
/* The terminal card (renderTerminalCard): the CLI's pull quote in a terminal window. */
.qk-term-card { width: ${SHARE_WIDTH}px; height: ${SHARE_HEIGHT}px; box-sizing: border-box; background: var(--qotm-ink); color: var(--qotm-paper); overflow: hidden; }
.qk-term-card__bar { display: flex; gap: 14px; padding: 36px 48px; border-bottom: 2px solid var(--qotm-ink-rule); }
.qk-term-card__bar i { width: 22px; height: 22px; border-radius: 50%; background: var(--qotm-stone-600); display: block; }
.qk-term-card__body { padding: 44px 72px 0; font-family: var(--qotm-font-mono); line-height: 1.45; }
.qk-term-card__accent { color: var(--qotm-clay-400); }
.qk-term-card__row { display: flex; gap: 2ch; padding-left: 2ch; margin-top: 1.45em; }
.qk-term-card__marks { display: block; width: 3em; height: 2.9em; flex-shrink: 0; color: var(--qotm-clay-400); }
.qk-term-card__col { min-width: 0; }
.qk-term-card__text { font-weight: 700; text-wrap: balance; }
.qk-term-card__by { margin-top: 1.45em; white-space: pre-wrap; color: var(--qotm-stone-400); }
.qk-term-card__ref { color: var(--qotm-stone-600); }
.qk-term-card__cmd { margin-top: 1.45em; }
.qk-term-card__cursor { display: inline-block; width: 0.6em; height: 1.1em; vertical-align: -0.2em; background: var(--qotm-paper); }
/* The page card (renderPageCard): the quote card's frame, a name instead of a quote. */
.qk-og { padding: 96px 96px 0 90px; }
.qk-og__eyebrow { font-family: var(--qotm-font-mono); font-size: 24px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--qotm-clay-500); }
.qk-og__title { margin-top: 22px; font-family: var(--qotm-font-display); font-weight: 600; font-size: 84px; line-height: 1.08; letter-spacing: -0.015em; max-width: 1000px; text-wrap: balance; }
.qk-og__line { margin-top: 18px; font-family: var(--qotm-font-mono); font-size: 26px; color: var(--qotm-stone-600); max-width: 1000px; text-wrap: balance; }
.qk-og__quote { margin-top: 44px; padding-left: 28px; border-left: 4px solid var(--qotm-clay-100, #eedbd0); max-width: 940px; }
.qk-og__text { font-family: var(--qotm-font-display); font-weight: 600; font-size: 36px; line-height: 1.25; text-wrap: pretty; }
.qk-og .qk-share__by { margin-top: 16px; font-size: 22px; }
.qk-og .qk-share__foot { justify-content: space-between; }
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
	card: ShareCard | PageCard
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
			variant === 'page'
				? `window.renderPageCard(${JSON.stringify(card)}, ${SHARE_HEIGHT}, ${MIN_TITLE_SIZE})`
				: variant === 'terminal'
					? `window.renderTerminalCard(${JSON.stringify(card)}, ${SHARE_HEIGHT}, ${terminalStart((card as ShareCard).text)}, ${MIN_TERMINAL_SIZE})`
					: `window.renderShareCard(${JSON.stringify(variant)}, ${JSON.stringify(card)}, ${SHARE_HEIGHT}, ${MIN_FONT_SIZE})`
		)) as number | null;
		if (fontSize === null) {
			const what = 'id' in card ? `Quote ${card.id}` : `Page ${card.path}`;
			throw new UnrecoverableError(`${what} does not fit the ${variant} card`);
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
