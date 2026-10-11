import {
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common';
import { Prisma } from '@qotm/db/client';
import { QuoteStatus as S, QuoteType } from '@qotm/db/enums';
import { PrismaService } from 'common/services';
import { CARD, toCard } from 'quotes/cards';
import { PUBLIC_ID_PATTERN } from 'quotes/public-id';
import { QuotesService } from 'quotes/services';
import { NOT_PUBLIC, canView } from 'quotes/visibility';
import { setReaction, type ReactionKind } from '../reactions';
import type { FavoritesQuery, FavoritesSyncChanges } from '../dto';
import type {
	FavoriteEntity,
	FavoritesSyncEntity,
	PaginatedFavoriteEntity,
	ReactionEntity
} from '../entity';

/**
 * Where a community original may still be recommended: recommending is a
 * curation signal, so it stops once the quote is in curation or curated
 * (design system: "Recommend appears only on community quotes that are not
 * yet curated").
 */
const RECOMMENDABLE: readonly S[] = [
	S.PUBLISHED,
	S.COMMUNITY_DISCOVERY,
	S.CURATION_CANDIDATE
];

/** Quotes a member may see: public ones, and their own not-withdrawn ones. */
const visibleTo = (userId: string): Prisma.QuoteWhereInput => ({
	OR: [
		{ status: { notIn: [...NOT_PUBLIC] } },
		{ contributorId: userId, status: { not: S.WITHDRAWN } }
	]
});

const SORTS: Record<
	FavoritesQuery['sort'],
	Prisma.FavoriteOrderByWithRelationInput[]
> = {
	recent: [{ createdAt: 'desc' }],
	author: [
		// Originals have no author: Postgres sorts them last ascending.
		{ quote: { author: { name: 'asc' } } },
		{ quote: { text: 'asc' } }
	],
	likes: [{ quote: { likeCount: 'desc' } }, { createdAt: 'desc' }]
};

@Injectable()
export class ReactionsService {
	constructor(
		private db: PrismaService,
		private quotes: QuotesService
	) {}

	/**
	 * Turns the member's like, favorite or recommendation on a quote on or off.
	 * Idempotent, and race-safe through setReaction. Removing always works on
	 * a quote the member reacted to, even once it is no longer visible.
	 */
	async toggle(
		userId: string,
		publicId: string,
		kind: ReactionKind,
		on: boolean
	): Promise<ReactionEntity> {
		const quote = PUBLIC_ID_PATTERN.test(publicId)
			? await this.db.quote.findUnique({
					where: { publicId },
					select: { id: true, type: true, status: true, contributorId: true }
				})
			: null;
		if (!quote || (on && !canView(quote, userId))) {
			throw new NotFoundException('Quote not found');
		}
		if (
			on &&
			kind === 'recommend' &&
			quote.type === QuoteType.ORIGINAL &&
			!RECOMMENDABLE.includes(quote.status)
		) {
			throw new ConflictException(
				'Recommending is for community originals not yet in curation'
			);
		}
		return setReaction(this.db, kind, { userId, quoteId: quote.id }, on);
	}

	/** The Favorites screen: filtered, sorted, paged. */
	async favorites(
		userId: string,
		query: FavoritesQuery
	): Promise<PaginatedFavoriteEntity> {
		const quote: Prisma.QuoteWhereInput = { ...visibleTo(userId) };
		if (query.q) {
			quote.AND = [
				{
					OR: [
						{ text: { contains: query.q, mode: 'insensitive' } },
						{ attribution: { contains: query.q, mode: 'insensitive' } },
						{ author: { name: { contains: query.q, mode: 'insensitive' } } }
					]
				}
			];
		}
		const where: Prisma.FavoriteWhereInput = { userId, quote };
		const [rows, total] = await Promise.all([
			this.db.favorite.findMany({
				where,
				orderBy: SORTS[query.sort],
				skip: (query.page - 1) * query.limit,
				take: query.limit,
				include: { quote: { include: CARD } }
			}),
			this.db.favorite.count({ where })
		]);
		const quotes = rows.map((r) => r.quote);
		const cards = await this.quotes.withViewer(
			quotes.map(toCard),
			quotes,
			userId
		);
		const list = cards.map((card, i): FavoriteEntity => ({
			...card,
			savedAt: rows[i].createdAt
		}));
		return {
			list,
			total,
			pageSize: list.length,
			currentPage: query.page,
			lastPage: Math.ceil(total / query.limit) || 1
		};
	}

	/** The member's complete favorites, for `qotm favorites` (CLI contract). */
	async syncState(
		userId: string,
		skipped: string[] = []
	): Promise<FavoritesSyncEntity> {
		const rows = await this.db.favorite.findMany({
			where: { userId, quote: visibleTo(userId) },
			orderBy: { createdAt: 'asc' },
			select: { createdAt: true, quote: { select: { publicId: true } } }
		});
		return {
			favorites: rows.map((r) => ({
				id: r.quote.publicId,
				addedAt: r.createdAt
			})),
			skipped
		};
	}

	/**
	 * Applies the CLI's offline changes and returns the merged set. Adds are
	 * idempotent and removes of anything not saved are no-ops, so a replayed
	 * batch changes nothing. Unknown or invisible ids in `add` are skipped.
	 */
	async sync(
		userId: string,
		changes: FavoritesSyncChanges
	): Promise<FavoritesSyncEntity> {
		const ids = [...new Set([...changes.add, ...changes.remove])];
		const quotes = await this.db.quote.findMany({
			where: { publicId: { in: ids } },
			select: { id: true, publicId: true, status: true, contributorId: true }
		});
		const byId = new Map(quotes.map((q) => [q.publicId, q]));
		const skipped: string[] = [];

		for (const publicId of new Set(changes.add)) {
			const quote = byId.get(publicId);
			if (!quote || !canView(quote, userId)) {
				skipped.push(publicId);
				continue;
			}
			await setReaction(
				this.db,
				'favorite',
				{ userId, quoteId: quote.id },
				true
			);
		}
		for (const publicId of new Set(changes.remove)) {
			const quote = byId.get(publicId);
			if (quote)
				await setReaction(
					this.db,
					'favorite',
					{ userId, quoteId: quote.id },
					false
				);
		}
		return this.syncState(userId, skipped);
	}
}
