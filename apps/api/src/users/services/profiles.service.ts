import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@qotm/db/client';
import { QuoteType, ReleaseState } from '@qotm/db/enums';
import { PrismaService } from 'common/services';
import { hasRole } from 'lib/access';
import { CARD, toCard } from 'quotes/cards';
import type { QuoteCardEntity } from 'quotes/entity';
import { QuotesService } from 'quotes/services';
import { CURATED_STATUSES, NOT_PUBLIC } from 'quotes/visibility';
import type {
	ContributionEntity,
	ContributionStatsEntity,
	PaginatedContributionEntity,
	ProfileEntity
} from '../entity';

/** What a profile shows of someone's quotes: public submissions only. */
export const PUBLIC_CONTRIBUTION = (
	userId: string
): Prisma.QuoteWhereInput => ({
	contributorId: userId,
	type: { not: QuoteType.PRIVATE },
	status: { notIn: [...NOT_PUBLIC] }
});

/** The role a profile shows: the highest design role they hold. */
function publicRole(role: string | null): ProfileEntity['role'] {
	for (const name of ['admin', 'moderator', 'verifier'] as const) {
		if (hasRole(role, name)) return name;
	}
	return hasRole(role, 'superuser') ? 'admin' : 'member';
}

/** A profile, or where its old handle now lives. */
export type ProfileLookup =
	| { kind: 'found'; userId: string; handle: string }
	| { kind: 'moved'; handle: string };

@Injectable()
export class ProfilesService {
	constructor(
		private db: PrismaService,
		private quotes: QuotesService
	) {}

	/**
	 * Resolves a handle. An old handle (HandleHistory) answers with the
	 * current one, so the caller can redirect; anything else is a 404.
	 */
	async lookup(raw: string): Promise<ProfileLookup> {
		const handle = raw.replace(/^@/, '').toLowerCase();
		const user = await this.db.user.findUnique({
			where: { handle },
			select: { id: true }
		});
		if (user) return { kind: 'found', userId: user.id, handle };
		const previous = await this.db.handleHistory.findUnique({
			where: { oldHandle: handle },
			select: { user: { select: { handle: true } } }
		});
		if (previous) return { kind: 'moved', handle: previous.user.handle };
		throw new NotFoundException('Member not found');
	}

	async profile(userId: string): Promise<ProfileEntity> {
		const user = await this.db.user.findUniqueOrThrow({
			where: { id: userId },
			select: {
				handle: true,
				name: true,
				image: true,
				bio: true,
				role: true,
				createdAt: true,
				showFavorites: true
			}
		});
		const where = PUBLIC_CONTRIBUTION(userId);
		const [quotes, contributions, curated] = await Promise.all([
			this.db.quote.count({ where: { ...where, type: QuoteType.ORIGINAL } }),
			this.db.quote.count({ where }),
			this.db.quote.count({
				where: { ...where, status: { in: [...CURATED_STATUSES] } }
			})
		]);
		return {
			handle: user.handle,
			name: user.name,
			image: user.image,
			bio: user.bio,
			role: publicRole(user.role),
			joinedAt: user.createdAt,
			showFavorites: user.showFavorites,
			stats: { quotes, contributions, curated }
		};
	}

	async stats(userId: string): Promise<ContributionStatsEntity> {
		const where = PUBLIC_CONTRIBUTION(userId);
		const [submitted, verified, curated, correctionsAccepted] =
			await Promise.all([
				this.db.quote.count({ where }),
				this.db.quote.count({ where: { ...where, verifiedAt: { not: null } } }),
				this.db.quote.count({
					where: { ...where, status: { in: [...CURATED_STATUSES] } }
				}),
				this.db.correction.count({ where: { actorId: userId } })
			]);
		return { submitted, verified, curated, correctionsAccepted };
	}

	/** The contributions tab: newest first, each with its latest release. */
	async contributions(
		userId: string,
		page: number,
		limit: number
	): Promise<PaginatedContributionEntity> {
		const where = PUBLIC_CONTRIBUTION(userId);
		const [rows, total] = await Promise.all([
			this.db.quote.findMany({
				where,
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				skip: (page - 1) * limit,
				take: limit,
				select: {
					publicId: true,
					text: true,
					type: true,
					status: true,
					createdAt: true,
					attribution: true,
					author: { select: { name: true } },
					releases: {
						where: { release: { state: ReleaseState.PUBLISHED } },
						select: {
							release: { select: { version: true, publishedAt: true } }
						}
					}
				}
			}),
			this.db.quote.count({ where })
		]);
		const list = rows.map((q): ContributionEntity => ({
			id: q.publicId,
			text: q.text,
			author: q.author?.name ?? q.attribution,
			type: q.type === QuoteType.ORIGINAL ? 'original' : 'canonical',
			status: q.status,
			submittedAt: q.createdAt,
			release:
				q.releases
					.map((r) => r.release)
					.sort((a, b) => +b.publishedAt! - +a.publishedAt!)[0]?.version ?? null
		}));
		return {
			list,
			total,
			pageSize: list.length,
			currentPage: page,
			lastPage: Math.ceil(total / limit) || 1
		};
	}

	/** Their favorites, only if they made them public; otherwise a 404. */
	async favorites(
		userId: string,
		viewerId?: string
	): Promise<{ list: QuoteCardEntity[] }> {
		const user = await this.db.user.findUniqueOrThrow({
			where: { id: userId },
			select: { showFavorites: true }
		});
		if (!user.showFavorites)
			throw new NotFoundException('Favorites are private');
		const rows = await this.db.favorite.findMany({
			where: { userId, quote: { status: { notIn: [...NOT_PUBLIC] } } },
			orderBy: { createdAt: 'desc' },
			take: 50,
			include: { quote: { include: CARD } }
		});
		const quotes = rows.map((r) => r.quote);
		return {
			list: await this.quotes.withViewer(quotes.map(toCard), quotes, viewerId)
		};
	}
}
