import { ReviewKind as K, ReviewOutcome as O } from '@qotm/db/enums';

/** The decisions each kind of review offers (design system, ReviewDecision). */
export const OUTCOMES: Record<K, readonly O[]> = {
	[K.VERIFICATION]: [O.VERIFY, O.NEEDS_EVIDENCE, O.REJECT],
	[K.CURATION]: [O.CURATE, O.KEEP_OUT],
	[K.MODERATION]: [O.PUBLISH, O.MARK_DISPUTED, O.WITHDRAW]
};

export function isOutcomeOf(kind: K, outcome: O) {
	return OUTCOMES[kind].includes(outcome);
}

/**
 * The curation checklist, in the design's order. Keys are stored in
 * ReviewDecision.checklist, so never rename one.
 */
export const CURATION_CHECKLIST = {
	on_topic: 'About programming, technology or engineering',
	stands_alone: 'Useful on its own, without context',
	accurate: 'Accurate, with provenance or a declared original',
	concise: 'Concise enough for a terminal',
	not_duplicate: 'Not a duplicate',
	lasting: 'Will still read well in five years',
	no_open_reports: 'No open reports or moderation issues'
} as const;

export type ChecklistItem = keyof typeof CURATION_CHECKLIST;
export type Checklist = Record<ChecklistItem, boolean>;

/** A checklist with exactly the known items, each a boolean. */
export function isChecklist(value: unknown): value is Checklist {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const keys = Object.keys(value);
	const items = Object.keys(CURATION_CHECKLIST);
	return (
		keys.length === items.length &&
		items.every(
			(item) => typeof (value as Record<string, unknown>)[item] === 'boolean'
		)
	);
}

/** A report's public reference: 412 → `r_0412`. */
export function reportRef(number: number) {
	return `r_${String(number).padStart(4, '0')}`;
}

/** The number behind a report reference, or null if it is not one. */
export function parseReportRef(ref: string) {
	const match = /^r_(\d{4,})$/.exec(ref);
	return match ? Number(match[1]) : null;
}
