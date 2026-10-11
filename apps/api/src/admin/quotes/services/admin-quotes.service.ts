import { Injectable } from '@nestjs/common';
import { QuoteType, ReleaseState } from '@qotm/db/enums';
import type { AuditEntry } from 'audit';
import { PrismaService } from 'common/services';
import { ExportJobs } from 'exports';
import { NOT_PUBLIC } from 'quotes/visibility';
import { RELEASE_ELIGIBLE } from 'releases';
import type { AdminQuoteFilters, AdminQuoteQuery } from '../dto';
import type { AdminQuoteListEntity } from '../entity';
import { adminQuoteWhere } from '../where';

const ROW = {
	author: { select: { name: true } },
	contributor: { select: { handle: true } }
} as const;

/** Admin › Quotes: every non-private quote, filterable, and its CSV export. */
@Injectable()
export class AdminQuotesService {
	constructor(
		private db: PrismaService,
		private exports: ExportJobs
	) {}

	async list(query: AdminQuoteQuery): Promise<AdminQuoteListEntity> {
		const [[rows, meta], publicCount, eligible] = await Promise.all([
			this.db.x.quote.paginate({
				where: adminQuoteWhere(query),
				include: ROW,
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				page: query.page,
				limit: query.limit
			}),
			this.db.quote.count({
				where: {
					type: { not: QuoteType.PRIVATE },
					status: { notIn: [...NOT_PUBLIC] }
				}
			}),
			this.db.quote.count({ where: RELEASE_ELIGIBLE })
		]);
		const list = rows as unknown as Array<
			(typeof rows)[number] & {
				author: { name: string } | null;
				contributor: { handle: string } | null;
			}
		>;
		const releases = await this.lastReleases(list.map((q) => q.id));
		return {
			counts: { public: publicCount, eligible },
			list: list.map((q) => ({
				id: q.publicId,
				text: q.text,
				author:
					q.type === QuoteType.ORIGINAL
						? q.contributor
							? `@${q.contributor.handle}`
							: null
						: (q.author?.name ?? q.attribution),
				type: q.type === QuoteType.ORIGINAL ? 'original' : 'canonical',
				status: q.status,
				lastRelease: releases.get(q.id) ?? null,
				createdAt: q.createdAt
			})),
			...meta
		};
	}

	/** Queues the CSV export of what the filters select; returns the job's id. */
	async export(
		filters: AdminQuoteFilters,
		actor: NonNullable<AuditEntry['actor']>
	) {
		return {
			id: await this.exports.quotes({ filters, requestedBy: actor })
		};
	}

	/** Each quote's newest published release. */
	private async lastReleases(quoteIds: string[]) {
		if (!quoteIds.length) return new Map<string, string>();
		const shipped = await this.db.releaseQuote.findMany({
			where: {
				quoteId: { in: quoteIds },
				release: { state: ReleaseState.PUBLISHED }
			},
			select: {
				quoteId: true,
				release: { select: { version: true, publishedAt: true } }
			}
		});
		const newest = new Map<string, { version: string; at: number }>();
		for (const { quoteId, release } of shipped) {
			const at = release.publishedAt?.getTime() ?? 0;
			if ((newest.get(quoteId)?.at ?? -1) < at) {
				newest.set(quoteId, { version: release.version, at });
			}
		}
		return new Map([...newest].map(([id, r]) => [id, r.version]));
	}
}
