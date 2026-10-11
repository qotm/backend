import { z } from 'zod';
import { dateTime } from 'common/schemas';
import { paginated } from 'common/entity';
import { QuoteCardEntity } from 'quotes/entity';

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

/** MatchCompare: the submission beside every possible match found for it. */
export const SubmissionMatchesEntity = z
	.object({
		submitted: z.object({ id: z.string(), text: z.string() }),
		matches: z.array(MatchEntity)
	})
	.meta({ id: 'SubmissionMatchesEntity' });
export type SubmissionMatchesEntity = z.input<typeof SubmissionMatchesEntity>;
