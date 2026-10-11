import { z } from 'zod';

export const ReleaseListQuery = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20)
});
export type ReleaseListQuery = z.output<typeof ReleaseListQuery>;

/** The publish dialog's "I reviewed the preview build." tick. */
export const PublishRelease = z.object({
	reviewed: z.literal(true, {
		error: 'Confirm that you reviewed the preview build'
	})
});
export type PublishRelease = z.output<typeof PublishRelease>;
