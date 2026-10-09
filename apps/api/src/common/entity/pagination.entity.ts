import { z } from 'zod';

/** What `db.x.<model>.paginate()` returns alongside the page of rows. */
export interface PaginationMeta {
	total: number;
	pageSize: number;
	currentPage: number;
	lastPage: number;
}

/**
 * A page of `item`, published in OpenAPI as the component `id`
 * (e.g. `PaginatedUserEntity`).
 */
export const paginated = <T extends z.ZodType>(item: T, id: string) =>
	z
		.object({
			total: z.number(),
			pageSize: z.number(),
			currentPage: z.number(),
			lastPage: z.number(),
			list: z.array(item)
		})
		.meta({ id });
