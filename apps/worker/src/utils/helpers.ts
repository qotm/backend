import type { PaginationOptions, PaginationInfo } from '#app/types.js';

/**
 * Calculates pagination information based on the provided options
 * @param options - pagination options for the query
 */
export const getPaginationInfo = (
	options: PaginationOptions
): PaginationInfo => {
	const page = options.page && options.page > 0 ? options.page : 1;
	const take = options.limit && options.limit > 0 ? options.limit : 10;
	return {
		skip: (page - 1) * take,
		take,
		page
	};
};
