import { z } from 'zod';
import { QuoteStatus, ReportStatus } from '@qotm/db/enums';
import { dateTime } from 'common/schemas';
import { paginated } from 'common/entity';
import { QuoteCardEntity, QuoteEntity } from 'quotes/entity';

const MatchEntity = z.object({
	id: z.string().meta({ example: 'q_2x7v3m' }),
	text: z.string(),
	author: z.string().nullable().meta({ example: 'Kent Beck' }),
	method: z.enum(['exact', 'fuzzy', 'author']),
	score: z.number().meta({ example: 0.97 }),
	dismissed: z.boolean()
});

/** A quote waiting in a queue: its card, since when, and its best open match. */
export const QueueItemEntity = QuoteCardEntity.extend({
	waitingSince: dateTime(),
	match: MatchEntity.nullable()
}).meta({ id: 'QueueItemEntity' });
export type QueueItemEntity = z.input<typeof QueueItemEntity>;

export const QueuePageEntity = paginated(QueueItemEntity, 'QueuePageEntity');
export type QueuePageEntity = z.input<typeof QueuePageEntity>;

/**
 * A quote as a reviewer sees it, whatever its status: the quote page plus
 * every move with its note (the submitter's evidence, earlier decisions).
 */
export const AdminQuoteEntity = QuoteEntity.extend({
	history: z.array(
		z.object({
			status: z.enum(QuoteStatus),
			at: dateTime(),
			note: z.string().nullable(),
			/** Null: the system (the originality check) or a former member. */
			by: z.object({ handle: z.string().meta({ example: 'ada' }) }).nullable()
		})
	)
}).meta({ id: 'AdminQuoteEntity' });
export type AdminQuoteEntity = z.input<typeof AdminQuoteEntity>;

/** MatchCompare: the submission beside every possible match found for it. */
export const SubmissionMatchesEntity = z
	.object({
		submitted: z.object({ id: z.string(), text: z.string() }),
		matches: z.array(MatchEntity)
	})
	.meta({ id: 'SubmissionMatchesEntity' });
export type SubmissionMatchesEntity = z.input<typeof SubmissionMatchesEntity>;

/** A report in the moderators' queue, with the quote it is about. */
export const AdminReportEntity = z
	.object({
		id: z.string().meta({ example: 'r_0412' }),
		reason: z.enum([
			'attribution',
			'content',
			'originality',
			'duplicate',
			'other'
		]),
		details: z.string().nullable(),
		status: z.enum(ReportStatus),
		reporter: z.string().nullable().meta({ example: 'lena' }),
		createdAt: dateTime(),
		resolvedAt: dateTime().nullable(),
		quote: QuoteCardEntity,
		/** The latest published release the quote is in: withdrawing it drops it from the next. */
		inRelease: z.string().nullable().meta({ example: 'v2026.08.3' })
	})
	.meta({ id: 'AdminReportEntity' });
export type AdminReportEntity = z.input<typeof AdminReportEntity>;

export const AdminReportPageEntity = paginated(
	AdminReportEntity,
	'AdminReportPageEntity'
);
export type AdminReportPageEntity = z.input<typeof AdminReportPageEntity>;
