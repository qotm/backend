import { z } from 'zod';
import { QuoteStatus, SourceKind } from '@qotm/db/enums';
import { dateTime } from 'common/schemas';

const ref = (example: string) => z.string().meta({ example });

export const QuoteAuthorEntity = z
	.object({ slug: ref('dijkstra'), name: ref('Edsger W. Dijkstra') })
	.meta({ id: 'QuoteAuthorEntity' });

export const QuoteTopicEntity = z
	.object({ slug: ref('software-design'), name: ref('software design') })
	.meta({ id: 'QuoteTopicEntity' });

/** The signed-in viewer's own state; absent for anonymous requests. */
export const QuoteViewerEntity = z
	.object({
		liked: z.boolean(),
		favorited: z.boolean(),
		recommended: z.boolean()
	})
	.meta({ id: 'QuoteViewerEntity' });
export type QuoteViewerEntity = z.input<typeof QuoteViewerEntity>;

/** A quote as feeds and lists show it (QuoteCard). */
export const QuoteCardEntity = z
	.object({
		id: ref('q_8f2k1c'),
		text: ref('Simplicity is prerequisite for reliability.'),
		type: z.enum(['canonical', 'original', 'private']),
		status: z.enum(QuoteStatus),
		author: QuoteAuthorEntity.nullable(),
		work: z.string().nullable().meta({ example: 'EWD 498' }),
		year: z.number().int().nullable().meta({ example: 1975 }),
		/** Null once the contributor's account is gone ("a former member"). */
		contributor: z
			.object({ handle: ref('kofi') })
			.nullable()
			.meta({ description: 'Null: "a former member".' }),
		topics: z.array(QuoteTopicEntity),
		counts: z.object({
			likes: z.number().int(),
			favorites: z.number().int(),
			recommends: z.number().int()
		}),
		publishedAt: dateTime().nullable(),
		viewer: QuoteViewerEntity.optional()
	})
	.meta({ id: 'QuoteCardEntity' });
export type QuoteCardEntity = z.input<typeof QuoteCardEntity>;

/** A quote page: the card plus provenance and its dated lifecycle. */
export const QuoteEntity = QuoteCardEntity.extend({
	context: z.string().nullable(),
	sourceUrl: z.string().nullable(),
	source: z
		.object({
			title: ref('EWD 498: How do we tell truths that might hurt?'),
			year: z.number().int().nullable(),
			kind: z.enum(SourceKind),
			url: z.string().nullable()
		})
		.nullable(),
	verifier: z.object({ handle: ref('mireille') }).nullable(),
	verifiedAt: dateTime().nullable(),
	/** Each status the quote reached, with its date (LifecycleSteps). */
	lifecycle: z.array(z.object({ status: z.enum(QuoteStatus), at: dateTime() })),
	/** Published releases it shipped in, oldest first. */
	releases: z.array(ref('v2026.08.3'))
}).meta({ id: 'QuoteEntity' });
export type QuoteEntity = z.input<typeof QuoteEntity>;

export const QuoteFeedEntity = z
	.object({
		list: z.array(QuoteCardEntity),
		/** Pass as `cursor` for the next page; null on the last one. */
		nextCursor: z.string().nullable().meta({ example: 'q_3m9d0a' })
	})
	.meta({ id: 'QuoteFeedEntity' });
export type QuoteFeedEntity = z.input<typeof QuoteFeedEntity>;

export const RelatedQuotesEntity = z
	.object({ list: z.array(QuoteCardEntity) })
	.meta({ id: 'RelatedQuotesEntity' });
export type RelatedQuotesEntity = z.input<typeof RelatedQuotesEntity>;
