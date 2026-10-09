import { z } from 'zod';
import { search } from '../schemas';

// Query strings arrive as text, so numbers are coerced before they are checked.
const pageNumber = () => z.coerce.number().int().min(1).optional();

export const CommonFilters = z.object({
	search: search(),
	limit: pageNumber(),
	page: pageNumber()
});
export type CommonFilters = z.output<typeof CommonFilters>;

// ISO 8601: a date, or a date-time with an offset.
const isoDateOrDateTime = () =>
	z
		.union([z.iso.date(), z.iso.datetime({ offset: true })])
		.optional()
		.meta({ example: '2026-01-01T00:00:00.000Z' });

export const DateFilters = z.object({
	from: isoDateOrDateTime(),
	to: isoDateOrDateTime()
});
export type DateFilters = z.output<typeof DateFilters>;
