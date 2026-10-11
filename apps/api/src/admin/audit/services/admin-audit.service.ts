import { Injectable } from '@nestjs/common';
import type { Prisma } from '@qotm/db/client';
import { AUDIT_ACTIONS, type AuditAction } from 'audit';
import { PrismaService } from 'common/services';
import type { AuditQuery } from '../dto';
import type {
	AuditActionListEntity,
	PaginatedAuditEntryEntity
} from '../entity';

const ACTIONS = Object.entries(AUDIT_ACTIONS) as [AuditAction, string][];

const labelOf = (action: string) =>
	AUDIT_ACTIONS[action as AuditAction] ?? action;

/**
 * The audit log, newest first. Read-only: rows are written by `recordAudit`
 * inside each change's transaction and never edited.
 */
@Injectable()
export class AdminAuditService {
	constructor(private db: PrismaService) {}

	async list(query: AuditQuery): Promise<PaginatedAuditEntryEntity> {
		const where: Prisma.AuditLogWhereInput = {};
		if (query.action) where.action = query.action;
		if (query.q) where.OR = searchOf(query.q);

		const [rows, meta] = await this.db.x.auditLog.paginate({
			where,
			orderBy: [{ at: 'desc' }, { id: 'desc' }],
			page: query.page,
			limit: query.limit
		});
		return {
			list: rows.map((row) => ({
				id: row.id,
				at: row.at,
				actor: row.actorHandle ? { handle: row.actorHandle } : null,
				action: row.action,
				label: labelOf(row.action),
				target: { type: row.targetType, id: row.targetId },
				note: row.note
			})),
			...meta
		};
	}

	actions(): AuditActionListEntity {
		return {
			list: ACTIONS.map(([action, label]) => ({ action, label }))
		};
	}
}

/**
 * "Search actor, action or target": the actor's handle (`@kofi` or `kofi`),
 * an action by its code or label ("withdrew" finds `quote.withdrawn`), the
 * target's reference, or the note.
 */
export function searchOf(q: string): Prisma.AuditLogWhereInput[] {
	const text = { contains: q, mode: 'insensitive' } as const;
	const lower = q.toLowerCase();
	const actions = ACTIONS.filter(
		([code, label]) =>
			code.includes(lower) || label.toLowerCase().includes(lower)
	).map(([code]) => code);
	const or: Prisma.AuditLogWhereInput[] = [
		{
			actorHandle: {
				contains: q.replace(/^@/, ''),
				mode: 'insensitive'
			}
		},
		{ targetId: { contains: q.replace(/^@/, ''), mode: 'insensitive' } },
		{ note: text }
	];
	if (actions.length) or.push({ action: { in: actions } });
	return or;
}
