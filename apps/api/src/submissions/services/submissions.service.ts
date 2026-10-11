import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { Prisma } from '@qotm/db/client';
import { QuoteStatus as S, QuoteType } from '@qotm/db/enums';
import { PrismaService } from 'common/services';
import { CARD, toCard } from 'quotes/cards';
import { initialStatus } from 'quotes/lifecycle';
import { PUBLIC_ID_PATTERN, withPublicId } from 'quotes/public-id';
import { QuotesService } from 'quotes/services';
import { moveQuote } from 'quotes/transition';
import { isPublic } from 'quotes/visibility';
import type {
	AddEvidence,
	EditQuote,
	MyQuotesQuery,
	SubmitPrivate,
	SubmitQuote
} from '../dto';
import type { MyQuoteEntity, MyQuotesEntity } from '../entity';

export const MATCHING_QUEUE = 'matching';
export const CHECK_ORIGINALITY = 'check-originality';

/** Waiting on someone: the "in review" tab, and what a contributor may withdraw. */
const IN_REVIEW: readonly S[] = [
	S.SUBMITTED,
	S.UNDER_REVIEW,
	S.NEEDS_EVIDENCE,
	S.ORIGINALITY_CHECK
];

const TABS: Record<MyQuotesQuery['tab'], Prisma.QuoteWhereInput> = {
	all: {},
	private: { type: QuoteType.PRIVATE },
	review: { status: { in: [...IN_REVIEW] } },
	public: {
		type: { not: QuoteType.PRIVATE },
		status: { notIn: [...IN_REVIEW, S.PRIVATE, S.REJECTED, S.WITHDRAWN] }
	}
};

const MINE = {
	...CARD,
	events: { select: { toStatus: true, at: true }, orderBy: { at: 'asc' } },
	reviews: {
		where: { note: { not: null } },
		select: {
			note: true,
			createdAt: true,
			actor: { select: { handle: true } }
		},
		orderBy: { createdAt: 'desc' },
		take: 1
	}
} satisfies Prisma.QuoteInclude;

type Tx = Prisma.TransactionClient;

@Injectable()
export class SubmissionsService {
	constructor(
		private db: PrismaService,
		private quotes: QuotesService,
		@InjectQueue(MATCHING_QUEUE) private matching: Queue
	) {}

	/**
	 * A new quote. Canonical ones go to verification, originals to the
	 * originality check (the job is queued after the commit), private ones stay
	 * their owner's.
	 */
	async submit(userId: string, input: SubmitQuote) {
		const topicIds = await this.topicIds(input.topics);
		const type = input.type.toUpperCase() as QuoteType;
		const links =
			input.type === 'original'
				? {}
				: await this.links(input.attribution, input.source);

		// A public-id collision aborts the Postgres transaction it happens in,
		// so the retry wraps the whole transaction, not just the insert.
		const quote = await withPublicId((publicId) =>
			this.db.$transaction(async (tx) => {
				const created = await tx.quote.create({
					data: {
						publicId,
						type,
						status: initialStatus(type),
						text: input.text,
						contributorId: userId,
						topics: { create: topicIds.map((topicId) => ({ topicId })) },
						...(input.type === 'original'
							? {}
							: {
									attribution: input.attribution ?? null,
									work: input.source ?? null,
									year: input.year ?? null,
									sourceUrl: input.sourceUrl ?? null,
									context: input.context ?? null,
									...links
								})
					}
				});
				await tx.quoteEvent.create({
					data: {
						quoteId: created.id,
						toStatus: created.status,
						actorId: userId
					}
				});
				if (type === QuoteType.ORIGINAL) {
					await moveQuote(tx, created, S.ORIGINALITY_CHECK, { actorId: null });
				}
				return created;
			})
		);

		if (type === QuoteType.ORIGINAL) await this.queueCheck(quote.id);
		return this.quotes.findOne(quote.publicId, userId);
	}

	async mine(userId: string, query: MyQuotesQuery): Promise<MyQuotesEntity> {
		const own = { contributorId: userId };
		const rows = await this.db.quote.findMany({
			where: { ...own, ...TABS[query.tab] },
			include: MINE,
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			take: query.limit + 1,
			...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {})
		});
		const page = rows.slice(0, query.limit);
		const [all, privateCount, review, publicCount] = await Promise.all(
			(['all', 'private', 'review', 'public'] as const).map((tab) =>
				this.db.quote.count({ where: { ...own, ...TABS[tab] } })
			)
		);
		const cards = await this.quotes.withViewer(page.map(toCard), page, userId);
		return {
			list: cards.map((card, i): MyQuoteEntity => ({
				...card,
				lifecycle: page[i].events.map((e) => ({
					status: e.toStatus,
					at: e.at
				})),
				review: page[i].reviews[0]
					? {
							note: page[i].reviews[0].note!,
							by: page[i].reviews[0].actor?.handle ?? null,
							at: page[i].reviews[0].createdAt
						}
					: null
			})),
			nextCursor:
				rows.length > query.limit ? page[page.length - 1].publicId : null,
			tabs: { all, private: privateCount, review, public: publicCount }
		};
	}

	/** Edits a private quote. Submitted quotes are what reviewers see: 409. */
	async edit(userId: string, publicId: string, input: EditQuote) {
		const quote = await this.own(userId, publicId);
		if (quote.type !== QuoteType.PRIVATE) {
			throw new ConflictException('Only a private quote can be edited');
		}
		const topicIds = input.topics ? await this.topicIds(input.topics) : null;
		await this.db.$transaction(async (tx) => {
			await tx.quote.update({
				where: { id: quote.id },
				data: {
					text: input.text,
					attribution: input.attribution,
					work: input.source,
					year: input.year,
					sourceUrl: input.sourceUrl,
					context: input.context
				}
			});
			if (topicIds) await this.setTopics(tx, quote.id, topicIds);
		});
		return this.quotes.findOne(publicId, userId);
	}

	/**
	 * A private quote is deleted. A submission still waiting on review is
	 * withdrawn, keeping its record and history. Once public, only a moderator
	 * can take it down: 409.
	 */
	async remove(userId: string, publicId: string) {
		const quote = await this.own(userId, publicId);
		if (quote.type === QuoteType.PRIVATE) {
			await this.db.quote.delete({ where: { id: quote.id } });
			return;
		}
		if (!IN_REVIEW.includes(quote.status)) {
			throw new ConflictException(
				isPublic(quote.status)
					? 'A public quote is withdrawn by a moderator; report it instead'
					: 'This quote is already closed'
			);
		}
		await this.db.$transaction((tx) =>
			moveQuote(tx, quote, S.WITHDRAWN, {
				actorId: userId,
				note: 'Withdrawn by its contributor'
			})
		);
	}

	/** A private quote becomes a community original, and is checked. */
	async submitPrivate(userId: string, publicId: string, input: SubmitPrivate) {
		const quote = await this.own(userId, publicId, { topics: true });
		if (quote.type !== QuoteType.PRIVATE) {
			throw new ConflictException('Only a private quote can be submitted');
		}
		const topicIds = input.topics
			? await this.topicIds(input.topics)
			: quote.topics.map((t) => t.topicId);
		if (!topicIds.length) {
			throw new BadRequestException(
				'Validation: topics - choose at least one topic'
			);
		}
		await this.db.$transaction(async (tx) => {
			if (input.topics) await this.setTopics(tx, quote.id, topicIds);
			// An original credits no external author.
			const original = { ...quote, type: QuoteType.ORIGINAL };
			await moveQuote(tx, original, S.SUBMITTED, {
				actorId: userId,
				data: {
					type: QuoteType.ORIGINAL,
					attribution: null,
					authorId: null,
					sourceId: null
				}
			});
			await moveQuote(
				tx,
				{ ...original, status: S.SUBMITTED },
				S.ORIGINALITY_CHECK,
				{
					actorId: null
				}
			);
		});
		await this.queueCheck(quote.id);
		return this.quotes.findOne(publicId, userId);
	}

	/** New evidence sends a quote a verifier sent back to review again. */
	async addEvidence(userId: string, publicId: string, input: AddEvidence) {
		const quote = await this.own(userId, publicId);
		if (quote.status !== S.NEEDS_EVIDENCE) {
			throw new ConflictException('This quote is not waiting for evidence');
		}
		await this.db.$transaction((tx) =>
			moveQuote(tx, quote, S.UNDER_REVIEW, {
				actorId: userId,
				note: input.note,
				data: {
					...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
					...(input.source ? { work: input.source } : {})
				}
			})
		);
		return this.quotes.findOne(publicId, userId);
	}

	/** One of the member's own quotes, or 404 — never someone else's. */
	private async own<I extends Prisma.QuoteInclude = Record<string, never>>(
		userId: string,
		publicId: string,
		include?: I
	) {
		const quote = PUBLIC_ID_PATTERN.test(publicId)
			? await this.db.quote.findFirst({
					where: { publicId, contributorId: userId },
					include: include ?? undefined
				})
			: null;
		if (!quote || quote.status === S.WITHDRAWN) {
			throw new NotFoundException('Quote not found');
		}
		return quote as Prisma.QuoteGetPayload<{ include: I }>;
	}

	/** The ids of topic slugs; any unknown slug is a 400 naming it. */
	private async topicIds(slugs: string[]) {
		const unique = [...new Set(slugs)];
		const topics = await this.db.topic.findMany({
			where: { slug: { in: unique } },
			select: { id: true, slug: true }
		});
		const unknown = unique.filter(
			(slug) => !topics.some((t) => t.slug === slug)
		);
		if (unknown.length) {
			throw new BadRequestException(
				`Validation: topics - unknown topic ${unknown.join(', ')}`
			);
		}
		return topics.map((t) => t.id);
	}

	private async setTopics(tx: Tx, quoteId: string, topicIds: string[]) {
		await tx.quoteTopic.deleteMany({ where: { quoteId } });
		await tx.quoteTopic.createMany({
			data: topicIds.map((topicId) => ({ quoteId, topicId }))
		});
	}

	/**
	 * Links an existing author and source when the typed names match exactly
	 * (ignoring case). Members never create authors or sources; a verifier
	 * links the rest.
	 */
	private async links(attribution?: string, source?: string) {
		const author = attribution
			? await this.db.author.findFirst({
					where: { name: { equals: attribution, mode: 'insensitive' } },
					select: { id: true }
				})
			: null;
		// A source is linked only with its author: an unknown author's quote
		// must not point at a known author's work.
		const found =
			author && source
				? await this.db.source.findFirst({
						where: {
							title: { equals: source, mode: 'insensitive' },
							authorId: author.id
						},
						select: { id: true }
					})
				: null;
		return { authorId: author?.id ?? null, sourceId: found?.id ?? null };
	}

	/** Queues the originality check (the worker's `matching` consumer, QOT-49). */
	private async queueCheck(quoteId: string) {
		await this.matching.add(
			CHECK_ORIGINALITY,
			{ quoteId },
			{
				jobId: `originality-${quoteId}`,
				attempts: 5,
				backoff: { type: 'exponential', delay: 10_000 }
			}
		);
	}
}
