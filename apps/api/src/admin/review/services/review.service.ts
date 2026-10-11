import {
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common';
import { Prisma } from '@qotm/db/client';
import {
	QuoteStatus as S,
	QuoteType,
	ReviewKind,
	ReviewOutcome
} from '@qotm/db/enums';
import { PrismaService } from 'common/services';
import { recordAudit, type AuditAction, type AuditEntry } from 'audit';
import { CARD, toCard } from 'quotes/cards';
import { PUBLIC_ID_PATTERN } from 'quotes/public-id';
import { QuotesService } from 'quotes/services';
import { moveQuote } from 'quotes/transition';
import type {
	CorrectQuote,
	ModerationDecision,
	QueueQuery,
	VerificationDecision
} from '../dto';
import type {
	QueueItemEntity,
	QueuePageEntity,
	SubmissionMatchesEntity
} from '../entity';

type Actor = NonNullable<AuditEntry['actor']>;
type Tx = Prisma.TransactionClient;

/**
 * What each queue holds. Submissions: originals the originality check holds
 * for a moderator, and canonical quotes nobody has picked up yet.
 * Verification: canonical quotes from submission until a verifier decides.
 */
const QUEUES = {
	submissions: [
		{ type: QuoteType.ORIGINAL, status: S.ORIGINALITY_CHECK },
		{ type: QuoteType.CANONICAL, status: S.SUBMITTED }
	],
	verification: [
		{
			type: QuoteType.CANONICAL,
			status: { in: [S.SUBMITTED, S.UNDER_REVIEW, S.NEEDS_EVIDENCE] }
		}
	]
} satisfies Record<string, Prisma.QuoteWhereInput[]>;

// Decisions read committed data and wait on row locks; moveQuote's
// conditional update turns a lost race into a 409, where the service default
// (serializable) would abort it with a 40001.
const ISOLATION = {
	isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
};

const VERIFICATION: Record<
	VerificationDecision['decision'],
	{ to: S; outcome: ReviewOutcome; action: AuditAction }
> = {
	verify: {
		to: S.VERIFIED,
		outcome: ReviewOutcome.VERIFY,
		action: 'quote.verified'
	},
	needs_evidence: {
		to: S.NEEDS_EVIDENCE,
		outcome: ReviewOutcome.NEEDS_EVIDENCE,
		action: 'quote.evidence_requested'
	},
	reject: {
		to: S.REJECTED,
		outcome: ReviewOutcome.REJECT,
		action: 'quote.rejected'
	}
};

const MODERATION: Record<
	ModerationDecision['decision'],
	{ to: S; outcome: ReviewOutcome; action: AuditAction }
> = {
	publish: {
		to: S.PUBLISHED,
		outcome: ReviewOutcome.PUBLISH,
		action: 'quote.published'
	},
	mark_disputed: {
		to: S.DISPUTED,
		outcome: ReviewOutcome.MARK_DISPUTED,
		action: 'quote.disputed'
	},
	withdraw: {
		to: S.WITHDRAWN,
		outcome: ReviewOutcome.WITHDRAW,
		action: 'quote.withdrawn'
	}
};

@Injectable()
export class ReviewService {
	constructor(
		private db: PrismaService,
		private quotes: QuotesService
	) {}

	/** A queue, longest-waiting first ("waiting" = since the quote's last move). */
	async queue(
		name: keyof typeof QUEUES,
		query: QueueQuery
	): Promise<QueuePageEntity> {
		const where: Prisma.QuoteWhereInput = { OR: QUEUES[name] };
		const total = await this.db.quote.count({ where });
		const ids = await this.db.quote.findMany({
			where,
			select: {
				id: true,
				events: { select: { at: true }, orderBy: { at: 'desc' }, take: 1 }
			}
		});
		const order = ids
			.map((q) => ({ id: q.id, since: q.events[0]?.at ?? new Date(0) }))
			.sort((a, b) => +a.since - +b.since || a.id.localeCompare(b.id))
			.slice((query.page - 1) * query.limit, query.page * query.limit);

		const rows = await this.db.quote.findMany({
			where: { id: { in: order.map((o) => o.id) } },
			include: {
				...CARD,
				matches: {
					where: { dismissedAt: null },
					orderBy: { score: 'desc' },
					take: 1,
					include: {
						matchedQuote: {
							select: {
								publicId: true,
								text: true,
								attribution: true,
								author: { select: { name: true } }
							}
						}
					}
				}
			}
		});
		const byId = new Map(rows.map((r) => [r.id, r]));
		const list = order.flatMap(({ id, since }): QueueItemEntity[] => {
			const row = byId.get(id);
			if (!row) return [];
			const best = row.matches[0];
			return [
				{
					...toCard(row),
					waitingSince: since,
					match: best
						? {
								id: best.matchedQuote.publicId,
								text: best.matchedQuote.text,
								author:
									best.matchedQuote.author?.name ??
									best.matchedQuote.attribution,
								method: best.method.toLowerCase() as
									'exact' | 'fuzzy' | 'author',
								score: best.score,
								dismissed: false
							}
						: null
				}
			];
		});
		return {
			list,
			total,
			pageSize: list.length,
			currentPage: query.page,
			lastPage: Math.ceil(total / query.limit) || 1
		};
	}

	/** Every possible match the originality check found for a submission. */
	async matches(publicId: string): Promise<SubmissionMatchesEntity> {
		const quote = await this.find(publicId);
		const matches = await this.db.matchResult.findMany({
			where: { quoteId: quote.id },
			orderBy: [
				{ dismissedAt: { sort: 'asc', nulls: 'first' } },
				{ score: 'desc' }
			],
			include: {
				matchedQuote: {
					select: {
						publicId: true,
						text: true,
						attribution: true,
						author: { select: { name: true } }
					}
				}
			}
		});
		return {
			submitted: { id: quote.publicId, text: quote.text },
			matches: matches.map((m) => ({
				id: m.matchedQuote.publicId,
				text: m.matchedQuote.text,
				author: m.matchedQuote.author?.name ?? m.matchedQuote.attribution,
				method: m.method.toLowerCase() as 'exact' | 'fuzzy' | 'author',
				score: m.score,
				dismissed: m.dismissedAt !== null
			}))
		};
	}

	/**
	 * Verify, ask for evidence or reject a canonical quote. One that nobody had
	 * picked up moves to UNDER_REVIEW first, so its history stays complete.
	 */
	async verify(actor: Actor, publicId: string, input: VerificationDecision) {
		const rule = VERIFICATION[input.decision];
		await this.db.$transaction(async (tx) => {
			let quote = await this.find(publicId, tx);
			if (quote.type !== QuoteType.CANONICAL) {
				throw new ConflictException('Only canonical quotes are verified');
			}
			if (input.decision === 'verify' && !quote.authorId) {
				throw new ConflictException(
					`Link the author before verifying (submitted as "${quote.attribution ?? 'unknown'}")`
				);
			}
			if (quote.status === S.SUBMITTED) {
				await moveQuote(tx, quote, S.UNDER_REVIEW, { actorId: actor.id });
				quote = { ...quote, status: S.UNDER_REVIEW };
			}
			await this.decide(tx, actor, quote, {
				kind: ReviewKind.VERIFICATION,
				...rule,
				note: input.note,
				data:
					input.decision === 'verify'
						? { verifierId: actor.id, verifiedAt: new Date() }
						: undefined
			});
		}, ISOLATION);
		return this.quotes.findOne(publicId, actor.id, { staff: true });
	}

	/** Publish, dispute or withdraw an original the originality check held. */
	async moderate(actor: Actor, publicId: string, input: ModerationDecision) {
		const rule = MODERATION[input.decision];
		await this.db.$transaction(async (tx) => {
			const quote = await this.find(publicId, tx);
			if (
				quote.type !== QuoteType.ORIGINAL ||
				quote.status !== S.ORIGINALITY_CHECK
			) {
				throw new ConflictException(
					'This quote is not waiting for a moderator'
				);
			}
			await this.decide(tx, actor, quote, {
				kind: ReviewKind.MODERATION,
				...rule,
				note: input.note
			});
			// Publishing over the possible matches is the moderator's answer to them.
			if (input.decision === 'publish') {
				await tx.matchResult.updateMany({
					where: { quoteId: quote.id, dismissedAt: null },
					data: { dismissedAt: new Date() }
				});
			}
		}, ISOLATION);
		return this.quotes.findOne(publicId, actor.id, { staff: true });
	}

	/**
	 * A verifier's correction: new wording is kept as a Correction (releases
	 * keep the text they shipped), and the author and source are linked.
	 */
	async correct(actor: Actor, publicId: string, input: CorrectQuote) {
		await this.db.$transaction(async (tx) => {
			const quote = await this.find(publicId, tx);
			if (quote.type === QuoteType.PRIVATE)
				throw new NotFoundException('Quote not found');

			const data: Prisma.QuoteUncheckedUpdateInput = {};
			if (input.author !== undefined) {
				data.authorId = input.author
					? (
							await this.ensure(
								tx.author.findUnique({ where: { slug: input.author } }),
								'Author'
							)
						).id
					: null;
			}
			if (input.sourceId !== undefined) {
				data.sourceId = input.sourceId
					? (
							await this.ensure(
								tx.source.findUnique({ where: { id: input.sourceId } }),
								'Source'
							)
						).id
					: null;
			}
			for (const key of ['year', 'sourceUrl', 'context'] as const) {
				if (input[key] !== undefined) data[key] = input[key];
			}
			const reworded = input.text !== undefined && input.text !== quote.text;
			if (reworded) {
				data.text = input.text;
				await tx.correction.create({
					data: {
						quoteId: quote.id,
						oldText: quote.text,
						newText: input.text!,
						actorId: actor.id,
						note: input.note
					}
				});
			}
			await tx.quote.update({ where: { id: quote.id }, data });
			await recordAudit(tx, {
				actor,
				action: 'quote.corrected',
				target: { type: 'quote', id: quote.publicId },
				note: input.note
			});
		}, ISOLATION);
		return this.quotes.findOne(publicId, actor.id, { staff: true });
	}

	/** The move, the ReviewDecision and the audit row, in the caller's transaction. */
	private async decide(
		tx: Tx,
		actor: Actor,
		quote: { id: string; publicId: string; type: QuoteType; status: S },
		decision: {
			kind: ReviewKind;
			to: S;
			outcome: ReviewOutcome;
			action: AuditAction;
			note?: string;
			data?: Prisma.QuoteUncheckedUpdateManyInput;
		}
	) {
		await moveQuote(tx, quote, decision.to, {
			actorId: actor.id,
			note: decision.note ?? null,
			beforeDispute: decision.to === S.DISPUTED ? quote.status : undefined,
			data: decision.data
		});
		await tx.reviewDecision.create({
			data: {
				kind: decision.kind,
				outcome: decision.outcome,
				quoteId: quote.id,
				actorId: actor.id,
				note: decision.note ?? null
			}
		});
		await recordAudit(tx, {
			actor,
			action: decision.action,
			target: { type: 'quote', id: quote.publicId },
			note: decision.note ?? null
		});
	}

	private async find(publicId: string, db: Tx | PrismaService = this.db) {
		const quote = PUBLIC_ID_PATTERN.test(publicId)
			? await db.quote.findUnique({ where: { publicId } })
			: null;
		if (!quote) throw new NotFoundException('Quote not found');
		return quote;
	}

	private async ensure<T>(found: Promise<T | null>, what: string) {
		const row = await found;
		if (!row) throw new NotFoundException(`${what} not found`);
		return row;
	}
}
