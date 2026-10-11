import { z } from 'zod';
import { HANDLE_PATTERN } from 'lib/handle';

/** Settings › Profile, Privacy and email. Email is not changed here. */
export const UpdateMe = z
	.object({
		name: z
			.string()
			.trim()
			.min(1)
			.max(80)
			.optional()
			.meta({ example: 'Ada Mensah' }),
		handle: z
			.string()
			.trim()
			.transform((h) => h.replace(/^@/, '').toLowerCase())
			.pipe(
				z.string().regex(HANDLE_PATTERN, '3–30 lowercase letters, digits or _')
			)
			.optional()
			.meta({ example: 'ada' }),
		bio: z.string().trim().max(160).nullable().optional(),
		showFavorites: z.boolean().optional(),
		emailOnReview: z.boolean().optional()
	})
	.meta({ id: 'UpdateMe' });
export type UpdateMe = z.output<typeof UpdateMe>;

/** Deleting an account is confirmed by typing its handle. */
export const DeleteMe = z
	.object({ confirm: z.string().trim().meta({ example: 'ada' }) })
	.meta({ id: 'DeleteMe' });
export type DeleteMe = z.output<typeof DeleteMe>;
