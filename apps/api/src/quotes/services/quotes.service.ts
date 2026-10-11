import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@qotm/db/client';
import { QuoteStatus, QuoteType, ReleaseState } from '@qotm/db/enums';
import { CacheService, PrismaService } from 'common/services';
import { PUBLIC_ID_PATTERN } from '../public-id';
import { IN_FEEDS, NOT_PUBLIC, canView } from '../visibility';
import type { QuoteFeedQuery } from '../dto';
import { CARD, toCard, type CardRow } from '../cards';
import type {
	QuoteCardEntity,
	QuoteEntity,
	QuoteFeedEntity,
	QuoteViewerEntity,
	RelatedQuotesEntity
} from '../entity';

/** How long a feed page's ordering is cached. Rows and counts are always fresh. */
const FEED_TTL_SECONDS = 60;
const RELATED_LIMIT = 4;

const DETAIL = {
	...CARD,
	source: { select: { title: true, year: true, kind: true, url: true } },
	verifier: { select: { handle: true } },
	events: { select: { toStatus: true, at: true }, orderBy: { at: 'asc' } },
	releases: {
		where: { release: { state: ReleaseState.PUBLISHED } },
		select: { release: { select: { version: true, publishedAt: true } } }
	}
} satisfies Prisma.QuoteInclude;

/** One feed page's ordering, as cached. */
interface FeedPage {
	ids: string[];
	nextCursor: string | null;
}

@Injectable()
export class QuotesService {
	constructor(
		private db: PrismaService,
		private cache: CacheService
	) {}

	async feed(
		query: QuoteFeedQuery,
		viewerId?: string
	): Promise<QuoteFeedEntity> {
		const key = `quotes:feed:${feedSeed(query.feed)}:${JSON.stringify(query)}`;
		let page = await this.cache.fetch<FeedPage>(key);
		if (!page) {
			page = await this.feedPage(query);
			await this.cache.store(key, page, FEED_TTL_SECONDS);
		}

		const rows = await this.db.quote.findMany({
			where: { publicId: { in: page.ids }, ...IN_FEEDS },
			include: CARD
		});
		const byId = new Map(rows.map((row) => [row.publicId, row]));
		const ordered = page.ids.flatMap((id) => byId.get(id) ?? []);
		return {
			list: await this.withViewer(ordered.map(toCard), ordered, viewerId),
			nextCursor: page.nextCursor
		};
	}

	async findOne(publicId: string, viewerId?: string): Promise<QuoteEntity> {
		const row = await this.findVisible(publicId, viewerId, DETAIL);
		const [card] = await this.withViewer([toCard(row)], [row], viewerId);
		return {
			...card,
			context: row.context,
			sourceUrl: row.sourceUrl,
			source: row.source,
			verifier: row.verifier,
			verifiedAt: row.verifiedAt,
			lifecycle: row.events.map((e) => ({ status: e.toStatus, at: e.at })),
			releases: row.releases
				.map((r) => r.release)
				.sort((a, b) => +a.publishedAt! - +b.publishedAt!)
				.map((r) => r.version)
		};
	}

	/**
	 * Quotes to read next: by the same author first, then by how many topics
	 * they share, then newest.
	 */
	async related(
		publicId: string,
		viewerId?: string
	): Promise<RelatedQuotesEntity> {
		const quote = await this.findVisible(publicId, viewerId, {
			topics: { select: { topicId: true } }
		});
		const topicIds = quote.topics.map((t) => t.topicId);
		const or: Prisma.QuoteWhereInput[] = [];
		if (quote.authorId) or.push({ authorId: quote.authorId });
		if (topicIds.length)
			or.push({ topics: { some: { topicId: { in: topicIds } } } });
		if (!or.length) return { list: [] };

		const candidates = await this.db.quote.findMany({
			where: { ...IN_FEEDS, id: { not: quote.id }, OR: or },
			include: CARD,
			orderBy: { publishedAt: 'desc' },
			take: 50
		});
		const shared = (row: CardRow) =>
			row.topics.filter((t) => topicIds.includes(t.topicId)).length;
		const sameAuthor = (row: CardRow) =>
			quote.authorId && row.authorId === quote.authorId ? 1 : 0;
		const ranked = candidates
			.map((row, order) => ({ row, order }))
			.sort(
				(a, b) =>
					sameAuthor(b.row) - sameAuthor(a.row) ||
					shared(b.row) - shared(a.row) ||
					a.order - b.order
			)
			.slice(0, RELATED_LIMIT)
			.map((x) => x.row);
		return {
			list: await this.withViewer(ranked.map(toCard), ranked, viewerId)
		};
	}

	/**
	 * The quote, if `viewerId` may see it. Anything else is a 404: a withdrawn
	 * quote says so and keeps its id; an unknown, private or unchecked one is
	 * simply not found.
	 */
	private async findVisible<I extends Prisma.QuoteInclude>(
		publicId: string,
		viewerId: string | undefined,
		include: I
	) {
		if (!PUBLIC_ID_PATTERN.test(publicId)) {
			throw new NotFoundException('Quote not found');
		}
		const row = await this.db.quote.findUnique({
			where: { publicId },
			include
		});
		if (row?.status === QuoteStatus.WITHDRAWN) {
			throw new NotFoundException(`Quote ${publicId} was withdrawn`);
		}
		if (!row || !canView(row, viewerId)) {
			throw new NotFoundException('Quote not found');
		}
		return row as Prisma.QuoteGetPayload<{ include: I }>;
	}

	/** The ordered public ids of one feed page, and the cursor after it. */
	private async feedPage(query: QuoteFeedQuery): Promise<FeedPage> {
		const ids =
			query.feed === 'discover'
				? await this.discoverIds(query)
				: await this.orderedIds(query);
		const more = ids.length > query.limit;
		const page = ids.slice(0, query.limit);
		return { ids: page, nextCursor: more ? page[page.length - 1] : null };
	}

	/** latest and curated: newest first, keyset-paginated on the cursor's row. */
	private async orderedIds(query: QuoteFeedQuery) {
		const where: Prisma.QuoteWhereInput = { ...IN_FEEDS, ...filtersOf(query) };
		if (query.feed === 'curated') {
			const current = await this.currentRelease();
			if (!current) return [];
			where.releases = { some: { releaseId: current } };
		}
		const rows = await this.db.quote.findMany({
			where,
			select: { publicId: true },
			orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
			take: query.limit + 1,
			...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {})
		});
		return rows.map((r) => r.publicId);
	}

	/**
	 * discover: every eligible quote in an order that is the same for everyone
	 * on a given day and reshuffles daily — mixed, but not personalised or
	 * ranked by engagement.
	 */
	private async discoverIds(query: QuoteFeedQuery) {
		const seed = feedSeed('discover');
		const type = query.type ? query.type.toUpperCase() : null;
		const rows = await this.db.$queryRaw<{ public_id: string }[]>`
			SELECT q.public_id
			FROM quotes q
			LEFT JOIN authors a ON a.id = q.author_id
			LEFT JOIN "user" u ON u.id = q.contributor_id
			WHERE q.published_at IS NOT NULL
				AND q.status::text <> ALL(${[...NOT_PUBLIC]}::text[])
				AND (${query.author ?? null}::text IS NULL OR a.slug = ${query.author ?? null})
				AND (${query.contributor ?? null}::text IS NULL OR u.handle = ${query.contributor ?? null})
				AND (${type}::text IS NULL OR q.type::text = ${type})
				AND (${query.topic ?? null}::text IS NULL OR EXISTS (
					SELECT 1 FROM quote_topics qt JOIN topics t ON t.id = qt.topic_id
					WHERE qt.quote_id = q.id AND t.slug = ${query.topic ?? null}))
				AND (${query.cursor ?? null}::text IS NULL
					OR md5(q.public_id || ${seed}) > md5(${query.cursor ?? ''} || ${seed}))
			ORDER BY md5(q.public_id || ${seed})
			LIMIT ${query.limit + 1}`;
		return rows.map((r) => r.public_id);
	}

	private async currentRelease() {
		const release = await this.db.release.findFirst({
			where: { state: ReleaseState.PUBLISHED },
			orderBy: { publishedAt: 'desc' },
			select: { id: true }
		});
		return release?.id ?? null;
	}

	/** Adds the viewer's own like/favorite/recommend state, when signed in. */
	async withViewer(
		cards: QuoteCardEntity[],
		rows: { id: string }[],
		viewerId?: string
	): Promise<QuoteCardEntity[]> {
		if (!viewerId || !rows.length) return cards;
		const where = { userId: viewerId, quoteId: { in: rows.map((r) => r.id) } };
		const select = { quoteId: true } as const;
		const [likes, favorites, recommends] = await Promise.all([
			this.db.like.findMany({ where, select }),
			this.db.favorite.findMany({ where, select }),
			this.db.recommendation.findMany({ where, select })
		]);
		const has = (set: { quoteId: string }[], id: string) =>
			set.some((r) => r.quoteId === id);
		return cards.map((card, i): QuoteCardEntity => {
			const id = rows[i].id;
			const viewer: QuoteViewerEntity = {
				liked: has(likes, id),
				favorited: has(favorites, id),
				recommended: has(recommends, id)
			};
			return { ...card, viewer };
		});
	}
}

function filtersOf(query: QuoteFeedQuery): Prisma.QuoteWhereInput {
	const where: Prisma.QuoteWhereInput = {};
	if (query.topic) where.topics = { some: { topic: { slug: query.topic } } };
	if (query.author) where.author = { slug: query.author };
	if (query.contributor) where.contributor = { handle: query.contributor };
	if (query.type) {
		where.type =
			query.type === 'canonical' ? QuoteType.CANONICAL : QuoteType.ORIGINAL;
	}
	return where;
}

/** Discover's daily seed (UTC); other feeds do not depend on the day. */
function feedSeed(feed: QuoteFeedQuery['feed']) {
	return feed === 'discover' ? new Date().toISOString().slice(0, 10) : 'static';
}
