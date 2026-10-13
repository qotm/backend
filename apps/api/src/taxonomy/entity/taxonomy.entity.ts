import { z } from 'zod';

/** Counts that match the feed for the same tab (GET /v1/quotes?state=…). */
const Counts = z.object({
	quotes: z.number().int().meta({ example: 214 }),
	curated: z.number().int().meta({ example: 131 })
});

export const TopicEntity = z
	.object({
		slug: z.string().meta({ example: 'debugging' }),
		name: z.string().meta({ example: 'debugging' }),
		description: z
			.string()
			.nullable()
			.meta({ example: 'Finding out why the code does what it does.' }),
		counts: Counts
	})
	.meta({ id: 'TopicEntity' });
export type TopicEntity = z.input<typeof TopicEntity>;

export const TopicListEntity = z
	.object({ list: z.array(TopicEntity) })
	.meta({ id: 'TopicListEntity' });
export type TopicListEntity = z.input<typeof TopicListEntity>;

/** AuthorHeader: name, lifespan line, topics, stats and tab counts. */
export const AuthorEntity = z
	.object({
		slug: z.string().meta({ example: 'dijkstra' }),
		name: z.string().meta({ example: 'Edsger W. Dijkstra' }),
		bornYear: z.number().int().nullable(),
		diedYear: z.number().int().nullable(),
		description: z.string().nullable().meta({ example: 'computer scientist' }),
		/** The Wikidata item, for the page's schema.org `sameAs`. */
		wikidataId: z.string().nullable().meta({ example: 'Q8556' }),
		/** "1930–2002 · computer scientist"; "1942–" while living; "—" when unknown. */
		line: z.string().meta({ example: '1930–2002 · computer scientist' }),
		/** The topics most of their quotes are in, most first (up to 4). */
		topics: z.array(z.object({ slug: z.string(), name: z.string() })),
		/** Tab counts, each matching GET /v1/quotes?author=…&state=…. */
		tabs: z.object({
			all: z.number().int(),
			curated: z.number().int(),
			review: z.number().int()
		})
	})
	.meta({ id: 'AuthorEntity' });
export type AuthorEntity = z.input<typeof AuthorEntity>;
