import { QuoteStatus as S } from '@qotm/db/enums';
import type { Prisma } from '@qotm/db/client';

/**
 * Who sees a quote. Private quotes are their owner's only; a submission waiting
 * for its first check (SUBMITTED, ORIGINALITY_CHECK) is visible to its
 * contributor alone; REJECTED and WITHDRAWN are visible to nobody. Everything
 * else — including a DISPUTED quote, which stays up while it is reviewed — is
 * public.
 */
export const NOT_PUBLIC: readonly S[] = [
	S.PRIVATE,
	S.SUBMITTED,
	S.ORIGINALITY_CHECK,
	S.REJECTED,
	S.WITHDRAWN
];

/** Statuses the owner may still open on the quote page (all but gone ones). */
const OWNER_HIDDEN: readonly S[] = [S.WITHDRAWN];

export function isPublic(status: S) {
	return !NOT_PUBLIC.includes(status);
}

export function canView(
	quote: { status: S; contributorId: string | null },
	viewerId?: string
) {
	if (isPublic(quote.status)) return true;
	return (
		Boolean(viewerId) &&
		quote.contributorId === viewerId &&
		!OWNER_HIDDEN.includes(quote.status)
	);
}

/**
 * Quotes a feed may show: public, and past their first check (verified, or a
 * published original), which is when `publishedAt` is set.
 */
export const IN_FEEDS: Prisma.QuoteWhereInput = {
	status: { notIn: [...NOT_PUBLIC] },
	publishedAt: { not: null }
};

/**
 * Public, but not for search engines yet: still being checked, or disputed.
 * Their pages are `noindex` and left out of the sitemap; the web server keeps
 * the same list.
 */
export const NOT_INDEXED: readonly S[] = [
	S.UNDER_REVIEW,
	S.NEEDS_EVIDENCE,
	S.DISPUTED
];

/** Quotes a search engine may index: in the feeds, and not under review or disputed. */
export const INDEXABLE: Prisma.QuoteWhereInput = {
	status: { notIn: [...NOT_PUBLIC, ...NOT_INDEXED] },
	publishedAt: { not: null }
};

/** Curated, and shipped in a release: the "curated" tab and count. */
export const CURATED_STATUSES: readonly S[] = [S.CURATED, S.DATASET_RELEASE];

/** Public but still being checked: the author page's "in review" tab. */
export const REVIEW_STATUSES: readonly S[] = [S.UNDER_REVIEW, S.NEEDS_EVIDENCE];

export type FeedState = 'all' | 'curated' | 'review';

/**
 * Which quotes a feed shows for a tab. `all` and `curated` hold to IN_FEEDS
 * (past their first check); `review` lists public quotes still being checked,
 * which have no `publishedAt` yet.
 */
export function feedWhere(state: FeedState = 'all'): Prisma.QuoteWhereInput {
	if (state === 'review') return { status: { in: [...REVIEW_STATUSES] } };
	if (state === 'curated') {
		return { ...IN_FEEDS, status: { in: [...CURATED_STATUSES] } };
	}
	return IN_FEEDS;
}
