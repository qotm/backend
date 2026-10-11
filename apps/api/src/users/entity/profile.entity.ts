import { z } from 'zod';
import { QuoteStatus } from '@qotm/db/enums';
import { dateTime } from 'common/schemas';
import { paginated } from 'common/entity';
import { QuoteCardEntity } from 'quotes/entity';

/** ProfileHeader. Never the email or anything private. */
export const ProfileEntity = z
	.object({
		handle: z.string().meta({ example: 'ada' }),
		name: z.string().meta({ example: 'Ada Mensah' }),
		image: z.string().nullable(),
		bio: z.string().nullable(),
		/** member, verifier, moderator or admin (the bootstrap superuser shows as admin). */
		role: z.enum(['member', 'verifier', 'moderator', 'admin']),
		joinedAt: dateTime(),
		/** Whether their favorites are public (GET /v1/users/:handle/favorites). */
		showFavorites: z.boolean(),
		stats: z.object({
			/** Their public community originals (the "quotes" tab). */
			quotes: z.number().int(),
			/** Everything they submitted that is public (the "contributions" tab). */
			contributions: z.number().int(),
			curated: z.number().int()
		})
	})
	.meta({ id: 'ProfileEntity' });
export type ProfileEntity = z.input<typeof ProfileEntity>;

/** The contributions tab's StatCards. */
export const ContributionStatsEntity = z
	.object({
		submitted: z.number().int(),
		verified: z.number().int(),
		curated: z.number().int(),
		correctionsAccepted: z.number().int()
	})
	.meta({ id: 'ContributionStatsEntity' });
export type ContributionStatsEntity = z.input<typeof ContributionStatsEntity>;

/** A ContributionRow. */
export const ContributionEntity = z
	.object({
		id: z.string().meta({ example: 'q_8f2k1c' }),
		text: z.string(),
		author: z.string().nullable().meta({ example: 'Edsger W. Dijkstra' }),
		type: z.enum(['canonical', 'original']),
		status: z.enum(QuoteStatus),
		submittedAt: dateTime(),
		/** The latest published release it shipped in, if any. */
		release: z.string().nullable().meta({ example: 'v2026.08.3' })
	})
	.meta({ id: 'ContributionEntity' });
export type ContributionEntity = z.input<typeof ContributionEntity>;

export const PaginatedContributionEntity = paginated(
	ContributionEntity,
	'PaginatedContributionEntity'
);
export type PaginatedContributionEntity = z.input<
	typeof PaginatedContributionEntity
>;

/** Someone's public favorites (shown only if they opted in). */
export const ProfileFavoritesEntity = z
	.object({ list: z.array(QuoteCardEntity) })
	.meta({ id: 'ProfileFavoritesEntity' });
export type ProfileFavoritesEntity = z.input<typeof ProfileFavoritesEntity>;
