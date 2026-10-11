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
