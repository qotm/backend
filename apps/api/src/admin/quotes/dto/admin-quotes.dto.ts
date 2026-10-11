import { z } from 'zod';
import { QuoteStatus } from '@qotm/db/enums';

/** Every state an admin may filter by: all but PRIVATE (never listed). */
const STATES = Object.values(QuoteStatus).filter(
	(s) => s !== QuoteStatus.PRIVATE
) as [QuoteStatus, ...QuoteStatus[]];

/** The list's filters; the CSV export takes the same ones. */
export const AdminQuoteFilters = z.object({
	q: z
		.string()
		.trim()
		.max(100)
		.optional()
		.transform((value) => value || undefined)
		.meta({
			description: 'Text, author or id: `simplicity`, `dijkstra`, `q_8f2k1c`'
		}),
	type: z.enum(['canonical', 'original']).optional(),
	state: z.enum(STATES).optional().meta({ example: 'VERIFIED' })
});
export type AdminQuoteFilters = z.output<typeof AdminQuoteFilters>;

export const AdminQuoteQuery = AdminQuoteFilters.extend({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20)
});
export type AdminQuoteQuery = z.output<typeof AdminQuoteQuery>;
