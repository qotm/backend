import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@qotm/db/client';
import { QuoteType } from '@qotm/db/enums';

export type ReactionKind = 'like' | 'favorite' | 'recommend';

type Db = Pick<PrismaClient, '$transaction'>;
type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * PrismaService defaults transactions to Serializable, where concurrent
 * toggles on one quote abort with a serialization failure (40001) instead of
 * waiting. Nothing here needs it: the quote row lock queues writers, the
 * primary key settles duplicate inserts and the increment is atomic.
 */
const ISOLATION = {
	isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
};

const COUNTER = {
	like: 'likeCount',
	favorite: 'favoriteCount',
	recommend: 'recommendCount'
} as const;

/** Inserts the row unless it exists; resolves to the rows inserted (0 or 1). */
function insert(tx: Tx, kind: ReactionKind, data: Key) {
	const args = { data: [data], skipDuplicates: true };
	if (kind === 'like') return tx.like.createMany(args);
	if (kind === 'favorite') return tx.favorite.createMany(args);
	return tx.recommendation.createMany(args);
}

/** Deletes the row if it exists; resolves to the rows deleted (0 or 1). */
function remove(tx: Tx, kind: ReactionKind, where: Key) {
	if (kind === 'like') return tx.like.deleteMany({ where });
	if (kind === 'favorite') return tx.favorite.deleteMany({ where });
	return tx.recommendation.deleteMany({ where });
}

interface Key {
	userId: string;
	quoteId: string;
}

/**
 * Turns a member's like, favorite or recommendation on or off. Idempotent:
 * repeating either is a no-op.
 *
 * The quote's count moves by exactly the rows the write changed, in the same
 * transaction and as an atomic increment, so concurrent and repeated toggles
 * cannot drift it: two racing "on"s insert one row between them (the primary
 * key decides) and add one; an "off" that loses a race deletes nothing and
 * subtracts nothing.
 *
 * Recommendations are only for community originals; anything else is a 400.
 * Whether the viewer may react at all (signed in, quote visible, recommend
 * only before curation) is the caller's check.
 */
export function setReaction(
	db: Db,
	kind: ReactionKind,
	key: Key,
	on: boolean
): Promise<{ active: boolean; count: number }> {
	return db.$transaction(async (tx) => {
		// Lock the quote first. Every reaction write takes its locks in the same
		// order (quote, then reaction row), so concurrent writes queue instead of
		// deadlocking between the reaction's unique index and the count update.
		const [quote] = await tx.$queryRaw<{ type: QuoteType }[]>`
			SELECT type FROM quotes WHERE id = ${key.quoteId} FOR UPDATE`;
		if (!quote) throw new NotFoundException('Quote not found');
		if (kind === 'recommend' && quote.type !== QuoteType.ORIGINAL) {
			throw new BadRequestException(
				'Only community originals can be recommended'
			);
		}

		const { count: changed } = on
			? await insert(tx, kind, key)
			: await remove(tx, kind, key);

		const counter = COUNTER[kind];
		const updated = await tx.quote.update({
			where: { id: key.quoteId },
			data: { [counter]: { increment: on ? changed : -changed } },
			select: { likeCount: true, favoriteCount: true, recommendCount: true }
		});

		return { active: on, count: updated[counter] };
	}, ISOLATION);
}
