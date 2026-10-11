import { z } from 'zod';
import { search } from 'common/schemas';

const publicId = z.string().regex(/^q_[0-9a-z]{6}$/);

/** The Favorites screen: filter, sort ("Recently saved", "Author A–Z", "Most liked") and "more". */
export const FavoritesQuery = z.object({
	q: search(),
	sort: z.enum(['recent', 'author', 'likes']).default('recent'),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(50).default(20)
});
export type FavoritesQuery = z.output<typeof FavoritesQuery>;

/** The CLI's offline changes (BUILD-PLAN §5): safe to replay. */
export const FavoritesSyncChanges = z
	.object({
		add: z.array(publicId).max(500).default([]),
		remove: z.array(publicId).max(500).default([])
	})
	.meta({ id: 'FavoritesSyncChanges' });
export type FavoritesSyncChanges = z.output<typeof FavoritesSyncChanges>;
