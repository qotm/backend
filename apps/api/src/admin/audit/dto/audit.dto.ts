import { z } from 'zod';
import { AUDIT_ACTIONS, type AuditAction } from 'audit';

const CODES = Object.keys(AUDIT_ACTIONS) as [AuditAction, ...AuditAction[]];

export const AuditQuery = z.object({
	q: z
		.string()
		.trim()
		.max(100)
		.optional()
		.transform((value) => value || undefined)
		.meta({
			description:
				'Actor handle, action, target or note: `@kofi`, `withdrew`, `q_5d3a8w`'
		}),
	action: z.enum(CODES).optional().meta({ example: 'quote.withdrawn' }),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(50)
});
export type AuditQuery = z.output<typeof AuditQuery>;
