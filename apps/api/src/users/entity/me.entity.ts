import { z } from 'zod';
import { dateTime } from 'common/schemas';

/** The member's own account, as Settings shows it. */
export const MeEntity = z
	.object({
		id: z.string(),
		name: z.string().meta({ example: 'Ada Mensah' }),
		handle: z.string().meta({ example: 'ada' }),
		email: z.string().meta({ example: 'ada@example.com' }),
		image: z.string().nullable(),
		bio: z.string().nullable(),
		role: z.string().nullable().meta({ example: 'member' }),
		showFavorites: z.boolean(),
		emailOnReview: z.boolean(),
		joinedAt: dateTime()
	})
	.meta({ id: 'MeEntity' });
export type MeEntity = z.input<typeof MeEntity>;
