import { ConflictException } from '@nestjs/common';
import { QuoteStatus as S, QuoteType } from '@qotm/db/enums';

/**
 * The quote lifecycle: every status move a quote may make, in one place.
 *
 * Two tracks (design system, LifecycleSteps):
 * - canonical: submitted → under review → verified → curation review →
 *   curated → in release
 * - original: submitted → originality check → published → in community →
 *   curation candidate → curation review → curated → in release
 *
 * Verification and curation stay separate: a quote can be VERIFIED and never
 * CURATED. Who may make a move (verifier, moderator, owner, the system) is the
 * caller's check; this module only says which moves exist.
 */

type Track = Exclude<QuoteType, 'PRIVATE'>;

/** The steps of each track, in order, for LifecycleSteps. */
export const TRACK_STEPS: Record<Track, readonly S[]> = {
	CANONICAL: [
		S.SUBMITTED,
		S.UNDER_REVIEW,
		S.VERIFIED,
		S.CURATION_REVIEW,
		S.CURATED,
		S.DATASET_RELEASE
	],
	ORIGINAL: [
		S.SUBMITTED,
		S.ORIGINALITY_CHECK,
		S.PUBLISHED,
		S.COMMUNITY_DISCOVERY,
		S.CURATION_CANDIDATE,
		S.CURATION_REVIEW,
		S.CURATED,
		S.DATASET_RELEASE
	]
};

/** Forward moves and review outcomes per track. */
const MOVES: Record<Track, Partial<Record<S, readonly S[]>>> = {
	CANONICAL: {
		// Publishing a private quote is always an explicit action.
		[S.PRIVATE]: [S.SUBMITTED],
		[S.SUBMITTED]: [S.UNDER_REVIEW],
		[S.UNDER_REVIEW]: [S.VERIFIED, S.NEEDS_EVIDENCE, S.REJECTED],
		// Evidence added: back to the verifier.
		[S.NEEDS_EVIDENCE]: [S.UNDER_REVIEW],
		[S.VERIFIED]: [S.CURATION_REVIEW],
		// Not curated: it stays verified.
		[S.CURATION_REVIEW]: [S.CURATED, S.VERIFIED],
		[S.CURATED]: [S.DATASET_RELEASE]
	},
	ORIGINAL: {
		[S.PRIVATE]: [S.SUBMITTED],
		[S.SUBMITTED]: [S.ORIGINALITY_CHECK],
		// QOT-13: a clean check publishes automatically; a possible match waits
		// here for a moderator, who publishes, marks it disputed or withdraws it
		// (the shared outcomes below). Originals are never REJECTED.
		[S.ORIGINALITY_CHECK]: [S.PUBLISHED],
		[S.PUBLISHED]: [S.COMMUNITY_DISCOVERY],
		[S.COMMUNITY_DISCOVERY]: [S.CURATION_CANDIDATE],
		[S.CURATION_CANDIDATE]: [S.CURATION_REVIEW],
		// Not curated: back among community quotes.
		[S.CURATION_REVIEW]: [S.CURATED, S.COMMUNITY_DISCOVERY],
		[S.CURATED]: [S.DATASET_RELEASE]
	}
};

/** No move leaves these. */
const TERMINAL: readonly S[] = [S.REJECTED, S.WITHDRAWN];

/** Statuses on a track: its steps plus the outcomes it can reach. */
function onTrack(track: Track, status: S) {
	return (
		status === S.PRIVATE ||
		status === S.DISPUTED ||
		TERMINAL.includes(status) ||
		TRACK_STEPS[track].includes(status) ||
		Object.values(MOVES[track]).some((to) => to?.includes(status))
	);
}

/**
 * Where a quote may go from `from`.
 *
 * Outcomes on top of each track's moves: any submitted quote that is not
 * finished may be WITHDRAWN or DISPUTED (a report under investigation), and a
 * DISPUTED quote either returns to `beforeDispute` (the status it held when
 * the dispute began) or is withdrawn.
 */
export function nextStatuses(type: QuoteType, from: S, beforeDispute?: S): S[] {
	if (type === QuoteType.PRIVATE) return [];
	if (!onTrack(type, from) || TERMINAL.includes(from)) return [];

	if (from === S.DISPUTED) {
		const restore =
			beforeDispute &&
			beforeDispute !== S.DISPUTED &&
			onTrack(type, beforeDispute) &&
			!TERMINAL.includes(beforeDispute)
				? [beforeDispute]
				: [];
		return [...restore, S.WITHDRAWN];
	}

	const moves = [...(MOVES[type][from] ?? [])];
	if (from !== S.PRIVATE) moves.push(S.DISPUTED, S.WITHDRAWN);
	return moves;
}

export function canTransition(
	type: QuoteType,
	from: S,
	to: S,
	beforeDispute?: S
) {
	return nextStatuses(type, from, beforeDispute).includes(to);
}

/** Throws a 409 when the move is not allowed. */
export function assertTransition(
	type: QuoteType,
	from: S,
	to: S,
	beforeDispute?: S
) {
	if (!canTransition(type, from, to, beforeDispute)) {
		throw new ConflictException(
			`A ${type.toLowerCase()} quote cannot move from ${from} to ${to}`
		);
	}
}

/** The status a new quote starts in. */
export function initialStatus(type: QuoteType) {
	return type === QuoteType.PRIVATE ? S.PRIVATE : S.SUBMITTED;
}
