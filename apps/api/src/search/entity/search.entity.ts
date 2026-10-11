import { z } from 'zod';
import { QuoteCardEntity } from 'quotes/entity';
import { TopicEntity } from 'taxonomy/entity';
import { SEARCH_TYPES } from '../dto';

/** An author result: the name, the AuthorHeader line and how many quotes. */
export const SearchAuthorEntity = z
	.object({
		slug: z.string().meta({ example: 'dijkstra' }),
		name: z.string().meta({ example: 'Edsger W. Dijkstra' }),
		line: z.string().meta({ example: '1930–2002 · computer scientist' }),
		/** Matches GET /v1/authors/:slug's `tabs.all`. */
		quotes: z.number().int().meta({ example: 48 })
	})
	.meta({ id: 'SearchAuthorEntity' });
export type SearchAuthorEntity = z.input<typeof SearchAuthorEntity>;

/**
 * One tab of results with every tab's count. Only the requested `type`'s
 * list is filled; the other two are empty.
 */
export const SearchEntity = z
	.object({
		q: z.string().meta({ example: 'complexity' }),
		type: z.enum(SEARCH_TYPES),
		/** The tab counts; all 0 when nothing matches. */
		counts: z.object({
			quotes: z.number().int().meta({ example: 3 }),
			authors: z.number().int().meta({ example: 0 }),
			topics: z.number().int().meta({ example: 1 })
		}),
		/** Paging over the requested type. */
		total: z.number().int(),
		pageSize: z.number().int(),
		currentPage: z.number().int(),
		lastPage: z.number().int(),
		quotes: z.array(QuoteCardEntity),
		authors: z.array(SearchAuthorEntity),
		topics: z.array(TopicEntity)
	})
	.meta({ id: 'SearchEntity' });
export type SearchEntity = z.input<typeof SearchEntity>;
