import { z } from 'zod';
import { dateTime } from 'common/schemas';
import { paginated } from 'common/entity';

export const AuditEntryEntity = z
	.object({
		id: z.string(),
		at: dateTime(),
		/** Null when the system acted. The handle is the one they had then. */
		actor: z
			.object({ handle: z.string().meta({ example: 'kofi' }) })
			.nullable(),
		action: z.string().meta({ example: 'quote.withdrawn' }),
		/** What the table shows: "Withdrew quote". */
		label: z.string().meta({ example: 'Withdrew quote' }),
		target: z.object({
			type: z.string().meta({ example: 'quote' }),
			/** The public reference: `q_5d3a8w`, `v2026.09.1`, a handle, a slug. */
			id: z.string().meta({ example: 'q_5d3a8w' })
		}),
		note: z
			.string()
			.nullable()
			.meta({ example: 'No source found; report r_0412' })
	})
	.meta({ id: 'AuditEntryEntity' });
export type AuditEntryEntity = z.input<typeof AuditEntryEntity>;

export const PaginatedAuditEntryEntity = paginated(
	AuditEntryEntity,
	'PaginatedAuditEntryEntity'
);
export type PaginatedAuditEntryEntity = z.input<
	typeof PaginatedAuditEntryEntity
>;

/** The action filter's options, in the order the codes were defined. */
export const AuditActionListEntity = z
	.object({
		list: z.array(
			z.object({
				action: z.string().meta({ example: 'quote.withdrawn' }),
				label: z.string().meta({ example: 'Withdrew quote' })
			})
		)
	})
	.meta({ id: 'AuditActionListEntity' });
export type AuditActionListEntity = z.input<typeof AuditActionListEntity>;
