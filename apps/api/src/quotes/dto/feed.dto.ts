import { z } from 'zod';

export const FEEDS = ['discover', 'latest', 'curated'] as const;
export type Feed = (typeof FEEDS)[number];

export const QuoteFeedQuery = z.object({
	feed: z.enum(FEEDS).default('latest').meta({
		description:
			'discover: mixed, the same order for everyone each day (not personalised, not ranked by engagement) · latest: newest first · curated: the current release'
	}),
	topic: z.string().max(60).optional().meta({ example: 'debugging' }),
	author: z.string().max(80).optional().meta({ example: 'dijkstra' }),
	contributor: z.string().max(30).optional().meta({ example: 'ada' }),
	type: z.enum(['canonical', 'original']).optional(),
	state: z.enum(['all', 'curated', 'review']).default('all').meta({
		description:
			'all · curated (curated or shipped) · review (public, still being checked; the author page tab)'
	}),
	cursor: z
		.string()
		.regex(/^q_[0-9a-z]{6}$/)
		.optional()
		.meta({ description: 'The `nextCursor` of the previous page.' }),
	limit: z.coerce.number().int().min(1).max(50).default(20)
});
export type QuoteFeedQuery = z.output<typeof QuoteFeedQuery>;
