import { z } from 'zod';
import { quoteText } from 'submissions/dto';
import { CURATION_CHECKLIST, type ChecklistItem } from 'review';

export const QueueQuery = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(50).default(20),
	/**
	 * An item's public id (`q_…`, `r_…`): answer the page that holds it instead
	 * of `page`, so a link to it opens it in place. Ignored when it is not in
	 * the queue.
	 */
	focus: z
		.string()
		.regex(/^[qr]_[a-z0-9]+$/)
		.optional()
});
export type QueueQuery = z.output<typeof QueueQuery>;

const note = z.string().trim().min(3).max(1000);

/** A verifier's decision. Needs evidence and reject say why: the submitter sees it. */
export const VerificationDecision = z
	.discriminatedUnion('decision', [
		z.object({ decision: z.literal('verify'), note: note.optional() }),
		z.object({ decision: z.literal('needs_evidence'), note }),
		z.object({ decision: z.literal('reject'), note })
	])
	.meta({ id: 'VerificationDecision' });
export type VerificationDecision = z.output<typeof VerificationDecision>;

/** A moderator's decision on an original the originality check held. */
export const ModerationDecision = z
	.discriminatedUnion('decision', [
		z.object({ decision: z.literal('publish'), note: note.optional() }),
		z.object({ decision: z.literal('mark_disputed'), note }),
		z.object({ decision: z.literal('withdraw'), note })
	])
	.meta({ id: 'ModerationDecision' });
export type ModerationDecision = z.output<typeof ModerationDecision>;

/**
 * A verifier's correction: new wording (kept as a Correction) and the author
 * and source the quote links to.
 */
export const CorrectQuote = z
	.object({
		text: quoteText().optional(),
		/** An Author's slug; null unlinks. */
		author: z.string().max(80).nullable().optional(),
		/** A Source's id; null unlinks. */
		sourceId: z.string().max(40).nullable().optional(),
		year: z.number().int().min(-3000).max(2100).nullable().optional(),
		sourceUrl: z
			.url({ protocol: /^https?$/ })
			.max(2048)
			.nullable()
			.optional(),
		context: z.string().trim().max(1000).nullable().optional(),
		/** Why: goes to the Correction and the audit log. */
		note: note
	})
	.meta({ id: 'CorrectQuote' });
export type CorrectQuote = z.output<typeof CorrectQuote>;

const checklist = z
	.object(
		Object.fromEntries(
			Object.keys(CURATION_CHECKLIST).map((key) => [key, z.boolean()])
		) as Record<ChecklistItem, z.ZodBoolean>
	)
	.strict()
	.meta({
		description: 'Every item of the curation checklist, ticked or not.'
	});

/**
 * A curator's decision, with the whole checklist. Curating needs every item
 * ticked; keeping a quote out says why.
 */
export const CurationDecision = z
	.discriminatedUnion('decision', [
		z.object({
			decision: z.literal('curate'),
			checklist,
			note: note.optional()
		}),
		z.object({ decision: z.literal('keep_out'), checklist, note })
	])
	.meta({ id: 'CurationDecision' });
export type CurationDecision = z.output<typeof CurationDecision>;

export const ReportQueueQuery = QueueQuery.extend({
	status: z.enum(['open', 'resolved']).default('open'),
	/** Only the reports on this quote (its public id), as the admin quote drawer asks. */
	quote: z
		.string()
		.regex(/^q_[a-z0-9]+$/)
		.optional()
});
export type ReportQueueQuery = z.output<typeof ReportQueueQuery>;

/**
 * A moderator's decision on a report. Dismiss (the design's "Publish") keeps
 * the quote up; mark disputed keeps it up while it is investigated; withdraw
 * takes it down for good, keeping its record and history.
 */
export const ReportDecision = z
	.discriminatedUnion('decision', [
		z.object({ decision: z.literal('dismiss'), note: note.optional() }),
		z.object({ decision: z.literal('mark_disputed'), note }),
		z.object({ decision: z.literal('withdraw'), note })
	])
	.meta({ id: 'ReportDecision' });
export type ReportDecision = z.output<typeof ReportDecision>;
