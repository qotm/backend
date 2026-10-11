import {
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common';
import { Prisma } from '@qotm/db/client';
import { ReportReason, ReportStatus } from '@qotm/db/enums';
import { PrismaService } from 'common/services';
import { PUBLIC_ID_PATTERN } from 'quotes/public-id';
import { isPublic } from 'quotes/visibility';
import { reportRef } from 'review';
import type { CreateReport } from '../dto';
import type { ReportEntity } from '../entity';

// Reads committed data and waits on the quote's row lock (below), rather than
// aborting a concurrent duplicate as PrismaService's serializable default would.
const ISOLATION = {
	isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
};

@Injectable()
export class ReportsService {
	constructor(private db: PrismaService) {}

	/**
	 * Reports a public quote to the moderators. The quote stays up while it is
	 * reviewed. A member has at most one open report per quote: the quote row
	 * is locked first, so two concurrent reports cannot both pass the check.
	 */
	create(
		reporterId: string,
		publicId: string,
		input: CreateReport
	): Promise<ReportEntity> {
		return this.db.$transaction(async (tx) => {
			const [quote] = PUBLIC_ID_PATTERN.test(publicId)
				? await tx.$queryRaw<{ id: string; status: string }[]>`
						SELECT id, status FROM quotes WHERE public_id = ${publicId} FOR UPDATE`
				: [];
			if (!quote || !isPublic(quote.status as never)) {
				throw new NotFoundException('Quote not found');
			}
			const open = await tx.report.findFirst({
				where: {
					quoteId: quote.id,
					reporterId,
					status: { not: ReportStatus.RESOLVED }
				},
				select: { number: true }
			});
			if (open) {
				throw new ConflictException(
					`You already reported this quote (${reportRef(open.number)}); a moderator is on it`
				);
			}
			const report = await tx.report.create({
				data: {
					quoteId: quote.id,
					reporterId,
					reason: input.reason.toUpperCase() as ReportReason,
					details: input.details ?? null
				}
			});
			return {
				id: reportRef(report.number),
				quote: publicId,
				reason: input.reason,
				details: report.details,
				status: report.status,
				createdAt: report.createdAt
			};
		}, ISOLATION);
	}
}
