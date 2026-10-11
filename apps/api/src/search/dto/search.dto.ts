import { z } from 'zod';

export const SEARCH_TYPES = ['quotes', 'authors', 'topics'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export const SearchQuery = z.object({
	q: z.string().trim().min(1).max(100).meta({ example: 'complexity' }),
	type: z.enum(SEARCH_TYPES).default('quotes').meta({
		description: 'Which tab to list; the counts cover all three.'
	}),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(50).default(20)
});
export type SearchQuery = z.output<typeof SearchQuery>;
