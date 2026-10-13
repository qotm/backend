import { createHash } from 'node:crypto';

export const SHARE_VARIANTS = ['quote', 'terminal'] as const;
export type ShareVariant = (typeof SHARE_VARIANTS)[number];

/**
 * Bump when the rendered layout changes (the worker's template), so every
 * image gets a new key and is rendered again.
 */
export const SHARE_TEMPLATE_VERSION = 1;
/**
 * The terminal card's own version: 2 is the CLI's pull quote (2026-10-13).
 * Bumping it renders only the terminal images again, not every quote card.
 */
export const TERMINAL_TEMPLATE_VERSION = 2;

/** What a ShareCard shows: the brand kit's quote card or terminal card. */
export interface ShareCard {
	id: string;
	text: string;
	author: string;
}

/** The card's credit line: the author, or a member for an original. */
export function shareCardOf(quote: {
	publicId: string;
	text: string;
	type: string;
	attribution: string | null;
	author: { name: string } | null;
	contributor: { handle: string } | null;
}): ShareCard {
	const author =
		quote.type === 'ORIGINAL'
			? quote.contributor
				? `@${quote.contributor.handle}`
				: 'a former member'
			: (quote.author?.name ?? quote.attribution ?? 'Unknown');
	return { id: quote.publicId, text: quote.text, author };
}

/**
 * The image's revision: a hash of everything it shows. A corrected wording
 * or credit is a new revision, so a new key and a fresh render; an unchanged
 * card keeps its key and its year-long cache.
 */
export function shareRevision(card: ShareCard, variant: ShareVariant) {
	return createHash('sha256')
		.update(
			JSON.stringify([
				variant === 'terminal'
					? TERMINAL_TEMPLATE_VERSION
					: SHARE_TEMPLATE_VERSION,
				variant,
				card
			])
		)
		.digest('hex')
		.slice(0, 12);
}

/** `share/q_8f2k1c/quote-1a2b3c4d5e6f.png`. */
export const shareKey = (id: string, variant: ShareVariant, revision: string) =>
	`share/${id}/${variant}-${revision}.png`;

export const PAGE_KINDS = ['author', 'topic', 'site'] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

/**
 * The og:image of a page that is not a quote: an author's, a topic's, or
 * the site's (home and the feeds). Drawn in the quote card's style: an
 * eyebrow, the name, its line, and one of its quotes.
 */
export interface PageCard {
	kind: PageKind;
	/** `/authors/dijkstra`, `/topics/debugging`, `/`: printed in the footer. */
	path: string;
	eyebrow: string;
	title: string;
	line: string | null;
	quote: { text: string; author: string } | null;
}

/** As `shareRevision`, for a page card. */
export function pageRevision(card: PageCard) {
	return createHash('sha256')
		.update(JSON.stringify([SHARE_TEMPLATE_VERSION, 'page', card]))
		.digest('hex')
		.slice(0, 12);
}

/** `og/authors/dijkstra-1a2b3c4d5e6f.png`, `og/site-1a2b3c4d5e6f.png`. */
export const pageKey = (card: PageCard, revision: string) =>
	card.kind === 'site'
		? `og/site-${revision}.png`
		: `og/${card.kind}s/${card.path.split('/').pop()}-${revision}.png`;
