import { z } from 'zod';
import { QuoteStatus } from '@qotm/db/enums';
import { dateTime } from 'common/schemas';

/** A row of Admin › Quotes. */
export const AdminQuoteRowEntity = z
	.object({
		id: z.string().meta({ example: 'q_8f2k1c' }),
		text: z.string(),
		/** The author's name, the typed attribution, or `@handle` for an original. */
		author: z.string().nullable().meta({ example: 'Edsger W. Dijkstra' }),
		type: z.enum(['canonical', 'original']),
		status: z.enum(QuoteStatus),
		/** The newest published release it shipped in. */
		lastRelease: z.string().nullable().meta({ example: 'v2026.08.3' }),
		/** Its topics' slugs (a bulk topic change counts them). */
		topics: z.array(z.string()).meta({ example: ['simplicity'] }),
		createdAt: dateTime()
	})
	.meta({ id: 'AdminQuoteRowEntity' });
export type AdminQuoteRowEntity = z.input<typeof AdminQuoteRowEntity>;

export const AdminQuoteListEntity = z
	.object({
		/** "12,963 public quotes. 12,631 are eligible for the next release." */
		counts: z.object({
			public: z.number().int().meta({ example: 12963 }),
			eligible: z.number().int().meta({ example: 12631 })
		}),
		total: z.number().int(),
		pageSize: z.number().int(),
		currentPage: z.number().int(),
		lastPage: z.number().int(),
		list: z.array(AdminQuoteRowEntity)
	})
	.meta({ id: 'AdminQuoteListEntity' });
export type AdminQuoteListEntity = z.input<typeof AdminQuoteListEntity>;

/** A queued CSV export; poll GET /v1/admin/exports/:id for it. */
export const ExportJobEntity = z
	.object({ id: z.string().meta({ example: 'export-3f9c…' }) })
	.meta({ id: 'ExportJobEntity' });
export type ExportJobEntity = z.input<typeof ExportJobEntity>;

/**
 * What a bulk action did: `done` changed, `unchanged` needed nothing (the
 * topic was already there, or not), `skipped` could not be changed, with why.
 */
export const BulkResultEntity = z
	.object({
		done: z.array(z.string()).meta({ example: ['q_8f2k1c'] }),
		unchanged: z.array(z.string()),
		skipped: z.array(
			z.object({
				id: z.string().meta({ example: 'q_5d3a8w' }),
				reason: z.string().meta({ example: 'already withdrawn' })
			})
		)
	})
	.meta({ id: 'BulkResultEntity' });
export type BulkResultEntity = z.input<typeof BulkResultEntity>;
