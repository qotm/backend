import { createHash } from 'node:crypto';

export const SHARE_VARIANTS = ['quote', 'terminal'] as const;
export type ShareVariant = (typeof SHARE_VARIANTS)[number];

/**
 * Bump when the rendered layout changes (the worker's template), so every
 * image gets a new key and is rendered again.
 */
export const SHARE_TEMPLATE_VERSION = 1;

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
		.update(JSON.stringify([SHARE_TEMPLATE_VERSION, variant, card]))
		.digest('hex')
		.slice(0, 12);
}

/** `share/q_8f2k1c/quote-1a2b3c4d5e6f.png`. */
export const shareKey = (id: string, variant: ShareVariant, revision: string) =>
	`share/${id}/${variant}-${revision}.png`;
