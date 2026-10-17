import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@qotm/db/client';
import { QuoteStatus as S, QuoteType, ReleaseState } from '@qotm/db/enums';
import { recordAudit, type AuditEntry } from 'audit';
import { LoggerService, PrismaService } from 'common/services';
import { ExportJobs } from 'exports';
import { moveQuote } from 'quotes/transition';
import { NOT_PUBLIC } from 'quotes/visibility';
import { RELEASE_ELIGIBLE } from 'releases';
import { IndexNowService } from 'share/services';
import type {
	AdminQuoteFilters,
	AdminQuoteQuery,
	BulkTopic,
	BulkWithdraw
} from '../dto';
import type { AdminQuoteListEntity, BulkResultEntity } from '../entity';
import { adminQuoteWhere } from '../where';

const ROW = {
	author: { select: { name: true } },
	contributor: { select: { handle: true } },
	topics: { select: { topic: { select: { slug: true } } } }
} as const;

type Actor = NonNullable<AuditEntry['actor']>;

/** Each quote's change is its own transaction: one that fails leaves the rest done. */
const ONE = {
	isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
};

/** Admin › Quotes: every non-private quote, filterable, and its CSV export. */
@Injectable()
export class AdminQuotesService {
	constructor(
		private db: PrismaService,
		private exports: ExportJobs,
		private indexNow: IndexNowService,
		private logger: LoggerService
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
				topics: { topic: { slug: string } }[];
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
				topics: q.topics.map((t) => t.topic.slug).sort(),
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

	/**
	 * Withdraws the selected quotes, each with the note, a history step and
	 * an audit entry of its own, as one would be. Never fails as a whole: a
	 * quote that cannot be withdrawn (gone, already withdrawn, rejected,
	 * moved meanwhile) is skipped and said why. Open reports on them stay
	 * for the moderators.
	 */
	async withdraw(input: BulkWithdraw, actor: Actor): Promise<BulkResultEntity> {
		const result: BulkResultEntity = { done: [], unchanged: [], skipped: [] };
		for (const id of new Set(input.ids)) {
			try {
				await this.db.$transaction(async (tx) => {
					const quote = await tx.quote.findUnique({ where: { publicId: id } });
					if (!quote || quote.type === QuoteType.PRIVATE)
						throw new Skip('not found');
					if (quote.status === S.WITHDRAWN) throw new Skip('already withdrawn');
					if (quote.status === S.REJECTED)
						throw new Skip('rejected, never public');
					await moveQuote(tx, quote, S.WITHDRAWN, {
						actorId: actor.id,
						note: input.note
					});
					await recordAudit(tx, {
						actor,
						action: 'quote.withdrawn',
						target: { type: 'quote', id },
						note: input.note
					});
				}, ONE);
				result.done.push(id);
				void this.indexNow.quote(id);
			} catch (error) {
				result.skipped.push({ id, reason: this.skipReason(error, id) });
			}
		}
		return result;
	}

	/**
	 * Adds a topic to the selected quotes, or takes it off them, with an audit
	 * entry for each one changed. A quote that already has it (or does not)
	 * is unchanged; one whose only topic it is keeps it, since every quote
	 * needs one.
	 */
	async topic(input: BulkTopic, actor: Actor): Promise<BulkResultEntity> {
		const topic = await this.db.topic.findUnique({
			where: { slug: input.topic }
		});
		if (!topic) throw new ConflictException(`No topic "${input.topic}"`);
		const result: BulkResultEntity = { done: [], unchanged: [], skipped: [] };
		for (const id of new Set(input.ids)) {
			try {
				const changed = await this.db.$transaction(async (tx) => {
					const quote = await tx.quote.findUnique({
						where: { publicId: id },
						select: {
							id: true,
							type: true,
							topics: { select: { topicId: true } }
						}
					});
					if (!quote || quote.type === QuoteType.PRIVATE)
						throw new Skip('not found');
					const has = quote.topics.some((t) => t.topicId === topic.id);
					if (input.action === 'add' ? has : !has) return false;
					if (input.action === 'remove' && quote.topics.length === 1) {
						throw new Skip('its only topic');
					}
					if (input.action === 'add') {
						await tx.quoteTopic.create({
							data: { quoteId: quote.id, topicId: topic.id }
						});
					} else {
						await tx.quoteTopic.delete({
							where: {
								quoteId_topicId: { quoteId: quote.id, topicId: topic.id }
							}
						});
					}
					await recordAudit(tx, {
						actor,
						action:
							input.action === 'add'
								? 'quote.topic_added'
								: 'quote.topic_removed',
						target: { type: 'quote', id },
						note: topic.slug
					});
					return true;
				}, ONE);
				(changed ? result.done : result.unchanged).push(id);
			} catch (error) {
				result.skipped.push({ id, reason: this.skipReason(error, id) });
			}
		}
		return result;
	}

	/** Why a quote was skipped; anything unexpected is logged, not swallowed. */
	private skipReason(error: unknown, id: string) {
		if (error instanceof Skip) return error.message;
		if (error instanceof ConflictException)
			return 'changed meanwhile; reload and try again';
		this.logger.warn({ error, id }, 'Bulk action failed on a quote');
		return 'could not be changed';
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

/** A quote a bulk action leaves alone, and why. */
class Skip extends Error {}
