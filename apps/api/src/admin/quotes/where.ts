import type { Prisma } from '@qotm/db/client';
import { QuoteType } from '@qotm/db/enums';
import { PUBLIC_ID_PATTERN } from 'quotes/public-id';
import type { AdminQuoteFilters } from './dto';

/**
 * The admin list's filter as a Prisma where. Private quotes are never
 * listed. The CSV export job (`apps/worker/src/workers/exports/`) builds the
 * same where from the same filters; keep the two in step.
 */
export function adminQuoteWhere(f: AdminQuoteFilters): Prisma.QuoteWhereInput {
	const where: Prisma.QuoteWhereInput = {
		type:
			f.type === 'canonical'
				? QuoteType.CANONICAL
				: f.type === 'original'
					? QuoteType.ORIGINAL
					: { not: QuoteType.PRIVATE }
	};
	if (f.state) where.status = f.state;
	if (f.q) {
		const text = { contains: f.q, mode: 'insensitive' } as const;
		where.OR = [
			{ text },
			{ attribution: text },
			{ author: { name: text } },
			...(PUBLIC_ID_PATTERN.test(f.q) ? [{ publicId: f.q }] : [])
		];
	}
	return where;
}
