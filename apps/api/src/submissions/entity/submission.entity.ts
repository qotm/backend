import { z } from 'zod';
import { QuoteStatus } from '@qotm/db/enums';
import { dateTime } from 'common/schemas';
import { QuoteCardEntity } from 'quotes/entity';

export const MatchEntity = z
	.object({
		/** The closest public quote, or null when nothing is close. */
		match: z
			.object({
				id: z.string().meta({ example: 'q_5k0q2j' }),
				text: z.string(),
				author: z.string().nullable().meta({ example: 'Donald E. Knuth' })
			})
			.nullable(),
		method: z.enum(['exact', 'fuzzy']).nullable(),
		/** Similarity 0–1. It flags a possible match; it never decides authorship. */
		score: z.number().min(0).max(1).nullable().meta({ example: 0.84 })
	})
	.meta({ id: 'MatchEntity' });
export type MatchEntity = z.input<typeof MatchEntity>;

/** One of my quotes: its card, where it is, and what a reviewer last said. */
export const MyQuoteEntity = QuoteCardEntity.extend({
	lifecycle: z.array(z.object({ status: z.enum(QuoteStatus), at: dateTime() })),
	review: z
		.object({
			note: z.string(),
			by: z.string().nullable().meta({ example: 'mireille' }),
			at: dateTime()
		})
		.nullable()
}).meta({ id: 'MyQuoteEntity' });
export type MyQuoteEntity = z.input<typeof MyQuoteEntity>;

export const MyQuotesEntity = z
	.object({
		list: z.array(MyQuoteEntity),
		nextCursor: z.string().nullable(),
		/** How many of my quotes each tab holds. */
		tabs: z.object({
			all: z.number().int(),
			private: z.number().int(),
			review: z.number().int(),
			public: z.number().int()
		})
	})
	.meta({ id: 'MyQuotesEntity' });
export type MyQuotesEntity = z.input<typeof MyQuotesEntity>;
