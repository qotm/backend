import type { Prisma } from '@qotm/db/client';
import { QuoteStatus as S, QuoteType } from '@qotm/db/enums';
import { moveQuote } from './transition';

/** Recommends from members other than its author that make an original a curation candidate. */
export const CANDIDATE_RECOMMENDS = 3;

/**
 * How a community original reaches curation (decided 2026-10-17): its first
 * recommend from another member puts it "in community", and
 * CANDIDATE_RECOMMENDS of them make it a curation candidate. A curator then
 * decides; recommends never curate, and taking one back never demotes.
 *
 * Runs inside the recommend's transaction, with the quote row locked. One a
 * curator has already looked at (kept out, back in community) is not put
 * forward again by recommends: only a curator's nomination brings it back.
 */
export async function promoteOriginal(
	tx: Prisma.TransactionClient,
	quoteId: string
) {
	const quote = await tx.quote.findUnique({
		where: { id: quoteId },
		select: { id: true, type: true, status: true, contributorId: true }
	});
	if (!quote || quote.type !== QuoteType.ORIGINAL) return;
	if (quote.status !== S.PUBLISHED && quote.status !== S.COMMUNITY_DISCOVERY)
		return;

	const others = await tx.recommendation.count({
		where: {
			quoteId,
			...(quote.contributorId ? { userId: { not: quote.contributorId } } : {})
		}
	});
	let status: S = quote.status;
	if (status === S.PUBLISHED && others >= 1) {
		await moveQuote(tx, { ...quote, status }, S.COMMUNITY_DISCOVERY, {
			actorId: null,
			note: 'Recommended by a member.'
		});
		status = S.COMMUNITY_DISCOVERY;
	}
	if (status !== S.COMMUNITY_DISCOVERY || others < CANDIDATE_RECOMMENDS) return;
	const reviewed = await tx.quoteEvent.count({
		where: { quoteId, toStatus: S.CURATION_REVIEW }
	});
	if (reviewed) return;
	await moveQuote(tx, { ...quote, status }, S.CURATION_CANDIDATE, {
		actorId: null,
		note: `Recommended by ${others} members.`
	});
}

/**
 * A curator's nomination: a published original, in community or not yet,
 * becomes a curation candidate, each step in its history. 409 for anything
 * else.
 */
export async function nominateOriginal(
	tx: Prisma.TransactionClient,
	quote: { id: string; type: QuoteType; status: S },
	actorId: string,
	note: string | null
) {
	if (quote.type !== QuoteType.ORIGINAL) {
		throw new NominationRefused('Only community originals are nominated');
	}
	let status = quote.status;
	if (status === S.PUBLISHED) {
		await moveQuote(tx, quote, S.COMMUNITY_DISCOVERY, { actorId });
		status = S.COMMUNITY_DISCOVERY;
	}
	if (status !== S.COMMUNITY_DISCOVERY) {
		throw new NominationRefused(
			'Only a published original that is not already in curation can be nominated'
		);
	}
	await moveQuote(tx, { ...quote, status }, S.CURATION_CANDIDATE, {
		actorId,
		note
	});
}

/** Why a nomination was refused: the caller answers 409 with it. */
export class NominationRefused extends Error {}
