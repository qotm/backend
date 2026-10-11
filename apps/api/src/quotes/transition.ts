import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@qotm/db/client';
import { QuoteStatus as S, type QuoteType } from '@qotm/db/enums';
import { assertTransition } from './lifecycle';

/** Statuses at which a quote first becomes public (its `publishedAt`). */
const FIRST_PUBLIC: readonly S[] = [S.VERIFIED, S.PUBLISHED];

/**
 * Moves a quote to `to` and records the QuoteEvent, inside the caller's
 * transaction. The move must be allowed by the lifecycle rules (409 if not),
 * and the quote must still be in the status the caller read (409 if someone
 * moved it meanwhile), so two concurrent decisions cannot both land.
 */
export async function moveQuote(
	tx: Prisma.TransactionClient,
	quote: { id: string; type: QuoteType; status: S },
	to: S,
	options: {
		actorId: string | null;
		note?: string | null;
		beforeDispute?: S;
		/** Extra fields to set with the move (verifier, wording…). */
		data?: Prisma.QuoteUncheckedUpdateManyInput;
	}
) {
	assertTransition(quote.type, quote.status, to, options.beforeDispute);
	const now = new Date();
	const { count } = await tx.quote.updateMany({
		where: { id: quote.id, status: quote.status },
		data: { ...options.data, status: to }
	});
	if (count === 0) {
		throw new ConflictException('The quote changed meanwhile; reload it');
	}
	if (FIRST_PUBLIC.includes(to)) {
		await tx.quote.updateMany({
			where: { id: quote.id, publishedAt: null },
			data: { publishedAt: now }
		});
	}
	await tx.quoteEvent.create({
		data: {
			quoteId: quote.id,
			fromStatus: quote.status,
			toStatus: to,
			actorId: options.actorId,
			note: options.note ?? null,
			at: now
		}
	});
}
