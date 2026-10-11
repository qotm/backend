import { z } from 'zod';
import { dateTime } from 'common/schemas';
import { paginated } from 'common/entity';
import { QuoteCardEntity } from 'quotes/entity';

/** The viewer's like, favorite or recommendation after a toggle, with the new count. */
export const ReactionEntity = z
	.object({
		active: z.boolean(),
		count: z.number().int().meta({ example: 189 })
	})
	.meta({ id: 'ReactionEntity' });
export type ReactionEntity = z.input<typeof ReactionEntity>;

export const FavoriteEntity = QuoteCardEntity.extend({
	savedAt: dateTime()
}).meta({
	id: 'FavoriteEntity'
});
export type FavoriteEntity = z.input<typeof FavoriteEntity>;

export const PaginatedFavoriteEntity = paginated(
	FavoriteEntity,
	'PaginatedFavoriteEntity'
);
export type PaginatedFavoriteEntity = z.input<typeof PaginatedFavoriteEntity>;

/** The member's complete favorites, as the CLI syncs them. */
export const FavoritesSyncEntity = z
	.object({
		favorites: z.array(
			z.object({
				id: z.string().meta({ example: 'q_8f2k1c' }),
				addedAt: dateTime()
			})
		),
		/** Ids in `add` that do not exist or are not visible; nothing was saved for them. */
		skipped: z.array(z.string())
	})
	.meta({ id: 'FavoritesSyncEntity' });
export type FavoritesSyncEntity = z.input<typeof FavoritesSyncEntity>;
