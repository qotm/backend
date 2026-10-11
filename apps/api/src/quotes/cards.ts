import type { Prisma } from '@qotm/db/client';
import type { QuoteCardEntity } from './entity';

/** What every quote card loads with the quote. */
export const CARD = {
	author: { select: { slug: true, name: true } },
	contributor: { select: { handle: true } },
	topics: {
		select: { topicId: true, topic: { select: { slug: true, name: true } } }
	}
} satisfies Prisma.QuoteInclude;

export type CardRow = Prisma.QuoteGetPayload<{ include: typeof CARD }>;

/** A quote row as a card (feeds, my quotes, related). */
export function toCard(row: CardRow): QuoteCardEntity {
	return {
		id: row.publicId,
		text: row.text,
		type: row.type.toLowerCase() as QuoteCardEntity['type'],
		status: row.status,
		author: row.author,
		attribution: row.attribution,
		work: row.work,
		year: row.year,
		contributor: row.contributor,
		topics: row.topics.map((t) => t.topic),
		counts: {
			likes: row.likeCount,
			favorites: row.favoriteCount,
			recommends: row.recommendCount
		},
		publishedAt: row.publishedAt
	};
}
