import { z } from 'zod';
import { QuoteStatus } from '@qotm/db/enums';

/** Every state an admin may filter by: all but PRIVATE (never listed). */
const STATES = Object.values(QuoteStatus).filter(
	(s) => s !== QuoteStatus.PRIVATE
) as [QuoteStatus, ...QuoteStatus[]];

const publicId = z
	.string()
	.regex(/^q_[a-z0-9]{3,32}$/)
	.meta({ example: 'q_8f2k1c' });
/** A selection on the Quotes page: one page of it at most. */
const selection = z.array(publicId).min(1).max(100);

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
	state: z.enum(STATES).optional().meta({ example: 'VERIFIED' }),
	/** Only these quotes (a selection): the other filters are ignored. */
	ids: z.array(publicId).min(1).max(100).optional()
});
export type AdminQuoteFilters = z.output<typeof AdminQuoteFilters>;

export const AdminQuoteQuery = AdminQuoteFilters.extend({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20)
});
export type AdminQuoteQuery = z.output<typeof AdminQuoteQuery>;

/** Withdraw the selected quotes, each with this note (required, as for one). */
export const BulkWithdraw = z
	.object({ ids: selection, note: z.string().trim().min(1).max(1000) })
	.meta({ id: 'BulkWithdraw' });
export type BulkWithdraw = z.output<typeof BulkWithdraw>;

/** Add a topic to the selected quotes, or take it off them. */
export const BulkTopic = z
	.object({
		ids: selection,
		topic: z
			.string()
			.regex(/^[a-z0-9-]{1,60}$/)
			.meta({ example: 'complexity' }),
		action: z.enum(['add', 'remove'])
	})
	.meta({ id: 'BulkTopic' });
export type BulkTopic = z.output<typeof BulkTopic>;
