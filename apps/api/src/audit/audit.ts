import type { Prisma } from '@qotm/db/client';

/**
 * Every audited action, with the label the audit log shows. Codes are stored
 * as-is, so never rename one; add new ones here.
 */
export const AUDIT_ACTIONS = {
	'quote.verified': 'Verified quote',
	'quote.evidence_requested': 'Asked for evidence',
	'quote.rejected': 'Rejected quote',
	'quote.published': 'Published original',
	'quote.curated': 'Curated quote',
	'quote.disputed': 'Disputed quote',
	'quote.restored': 'Restored quote',
	'quote.withdrawn': 'Withdrew quote',
	'quote.corrected': 'Corrected wording',
	'report.resolved': 'Resolved report',
	'release.preview_built': 'Built release preview',
	'release.published': 'Published release',
	'user.role_changed': 'Changed role',
	'author.created': 'Added author',
	'author.updated': 'Edited author',
	'source.created': 'Added source',
	'source.updated': 'Edited source',
	'topic.created': 'Added topic',
	'topic.updated': 'Edited topic'
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export type AuditTargetType =
	'quote' | 'release' | 'user' | 'report' | 'author' | 'source' | 'topic';

export interface AuditEntry {
	/** Who acted; null when the system did. */
	actor: { id: string; handle: string } | null;
	action: AuditAction;
	/** `id` is the target's public reference: `q_5d3a8w`, `v2026.09.1`, a handle. */
	target: { type: AuditTargetType; id: string };
	note?: string | null;
}

/**
 * Appends one audit row through `tx`, the transaction client of the change
 * being recorded, so the row commits with that change or not at all:
 *
 *   await db.$transaction(async (tx) => {
 *     await tx.quote.update(...);
 *     await recordAudit(tx, { actor, action: 'quote.withdrawn', target: { type: 'quote', id } });
 *   });
 *
 * The log is append-only: nothing updates or deletes its rows.
 */
export function recordAudit(tx: Prisma.TransactionClient, entry: AuditEntry) {
	return tx.auditLog.create({
		data: {
			actorId: entry.actor?.id ?? null,
			actorHandle: entry.actor?.handle ?? null,
			action: entry.action,
			targetType: entry.target.type,
			targetId: entry.target.id,
			note: entry.note ?? null
		}
	});
}
