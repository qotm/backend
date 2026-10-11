import { Injectable } from '@nestjs/common';
import { Prisma } from '@qotm/db/client';
import { PrismaService } from 'common/services';
import { QuotesService } from 'quotes/services';
import { CARD, toCard } from 'quotes/cards';
import { NOT_PUBLIC, feedWhere } from 'quotes/visibility';
import { lifespanLine } from 'taxonomy/services';
import type { SearchQuery } from '../dto';
import type { SearchEntity } from '../entity';

/**
 * How close a typed word must be to a word in a name for `<%` (pg_trgm's
 * word_similarity). 0.4 lets one transposition through ("djikstra" scores
 * 0.44 against "Edsger W. Dijkstra") without matching unrelated names.
 */
export const NAME_THRESHOLD = 0.4;

/** `%text%` for ILIKE, with the pattern characters in `text` escaped. */
export function containsPattern(text: string) {
	return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Search over public quotes, authors and topics (the Search page and the
 * header's field).
 *
 * - Quotes: Postgres full-text over the text (English stemming, web-search
 *   syntax: `"exact phrase"`, `-word`, `or`), through the expression index
 *   `quotes_text_fts_idx`, plus every quote by an author the query names.
 *   Any public quote matches, checked or still in review; private,
 *   unchecked, rejected and withdrawn ones never do, not even for their
 *   owner.
 * - Authors and topics: a substring of the name, or a typo-tolerant match
 *   through the trigram indexes on their names.
 */
@Injectable()
export class SearchService {
	constructor(
		private db: PrismaService,
		private quotes: QuotesService
	) {}

	async search(query: SearchQuery, viewerId?: string): Promise<SearchEntity> {
		const { q, type, page, limit } = query;
		const like = containsPattern(q);
		const authorMatch = Prisma.sql`(${q} <% a.name OR a.name ILIKE ${like} OR a.slug = lower(${q}))`;
		const topicMatch = Prisma.sql`(${q} <% t.name OR t.name ILIKE ${like} OR t.slug = lower(${q}))`;
		const quoteMatch = Prisma.sql`
			q.status::text <> ALL(${[...NOT_PUBLIC]}::text[])
			AND (to_tsvector('english', q.text) @@ websearch_to_tsquery('english', ${q})
				OR q.author_id IN (SELECT a.id FROM authors a WHERE ${authorMatch}))`;
		const offset = (page - 1) * limit;
		const take = (t: typeof type) => (type === t ? limit : 0);

		const [, counts, quoteRows, authorRows, topicRows] =
			await this.db.$transaction([
				this.db.$executeRawUnsafe(
					`SET LOCAL pg_trgm.word_similarity_threshold = ${NAME_THRESHOLD}`
				),
				this.db.$queryRaw<
					{ quotes: number; authors: number; topics: number }[]
				>`
					SELECT
						(SELECT count(*)::int FROM quotes q WHERE ${quoteMatch}) AS quotes,
						(SELECT count(*)::int FROM authors a WHERE ${authorMatch}) AS authors,
						(SELECT count(*)::int FROM topics t WHERE ${topicMatch}) AS topics`,
				// Best text match first; quotes found through their author after
				// the ones whose words match; then newest.
				this.db.$queryRaw<{ id: string }[]>`
					SELECT q.id FROM quotes q
					WHERE ${quoteMatch}
					ORDER BY ts_rank(to_tsvector('english', q.text),
							websearch_to_tsquery('english', ${q})) DESC,
						q.published_at DESC NULLS LAST, q.created_at DESC, q.id
					LIMIT ${take('quotes')} OFFSET ${offset}`,
				this.db.$queryRaw<{ id: string }[]>`
					SELECT a.id FROM authors a
					WHERE ${authorMatch}
					ORDER BY word_similarity(${q}, a.name) DESC, a.name, a.id
					LIMIT ${take('authors')} OFFSET ${offset}`,
				this.db.$queryRaw<{ id: string }[]>`
					SELECT t.id FROM topics t
					WHERE ${topicMatch}
					ORDER BY word_similarity(${q}, t.name) DESC, t.name, t.id
					LIMIT ${take('topics')} OFFSET ${offset}`
			]);

		const [quotes, authors, topics] = await Promise.all([
			this.quoteCards(
				quoteRows.map((r) => r.id),
				viewerId
			),
			this.authorHits(authorRows.map((r) => r.id)),
			this.topicHits(topicRows.map((r) => r.id))
		]);
		const total = counts[0][type];
		return {
			q,
			type,
			counts: counts[0],
			total,
			pageSize: limit,
			currentPage: page,
			lastPage: Math.max(1, Math.ceil(total / limit)),
			quotes,
			authors,
			topics
		};
	}

	private async quoteCards(ids: string[], viewerId?: string) {
		if (!ids.length) return [];
		const rows = await this.db.quote.findMany({
			where: { id: { in: ids } },
			include: CARD
		});
		const ordered = inOrder(ids, rows);
		return this.quotes.withViewer(ordered.map(toCard), ordered, viewerId);
	}

	private async authorHits(ids: string[]) {
		if (!ids.length) return [];
		const [rows, counts] = await Promise.all([
			this.db.author.findMany({ where: { id: { in: ids } } }),
			this.db.quote.groupBy({
				by: ['authorId'],
				where: { ...feedWhere('all'), authorId: { in: ids } },
				_count: { _all: true }
			})
		]);
		const count = new Map(counts.map((c) => [c.authorId, c._count._all]));
		return inOrder(ids, rows).map((a) => ({
			slug: a.slug,
			name: a.name,
			line: lifespanLine(a),
			quotes: count.get(a.id) ?? 0
		}));
	}

	private async topicHits(ids: string[]) {
		if (!ids.length) return [];
		const count = async (state: 'all' | 'curated') => {
			const rows = await this.db.quoteTopic.groupBy({
				by: ['topicId'],
				where: { topicId: { in: ids }, quote: feedWhere(state) },
				_count: { _all: true }
			});
			return new Map(rows.map((r) => [r.topicId, r._count._all]));
		};
		const [rows, all, curated] = await Promise.all([
			this.db.topic.findMany({ where: { id: { in: ids } } }),
			count('all'),
			count('curated')
		]);
		return inOrder(ids, rows).map((t) => ({
			slug: t.slug,
			name: t.name,
			description: t.description,
			counts: { quotes: all.get(t.id) ?? 0, curated: curated.get(t.id) ?? 0 }
		}));
	}
}

/** `rows` in the order of `ids`. */
function inOrder<T extends { id: string }>(ids: string[], rows: T[]) {
	const byId = new Map(rows.map((r) => [r.id, r]));
	return ids.flatMap((id) => byId.get(id) ?? []);
}
