import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common';
import { Prisma } from '@qotm/db/client';
import { QuoteType } from '@qotm/db/enums';
import { PrismaService } from 'common/services';
import { hasRole } from 'lib/access';
import type { DeleteMe, UpdateMe } from '../dto';
import type { MeEntity } from '../entity';

const SELECT = {
	id: true,
	name: true,
	handle: true,
	email: true,
	image: true,
	bio: true,
	role: true,
	showFavorites: true,
	emailOnReview: true,
	createdAt: true
} as const;

type Row = Prisma.UserGetPayload<{ select: typeof SELECT }>;

const toMe = ({ createdAt, ...user }: Row): MeEntity => ({
	...user,
	joinedAt: createdAt
});

// Read committed: the handle check and the history row are serialized by the
// unique indexes, not by aborting concurrent transactions.
const ISOLATION = {
	isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
};

@Injectable()
export class MeService {
	constructor(private db: PrismaService) {}

	async get(userId: string): Promise<MeEntity> {
		const user = await this.db.user.findUnique({
			where: { id: userId },
			select: SELECT
		});
		if (!user) throw new NotFoundException('User not found');
		return toMe(user);
	}

	/**
	 * Settings: name, handle, bio, privacy and email preferences. A new handle
	 * leaves the old one in HandleHistory, so old /@handle links keep working
	 * and nobody else can take it; the member may take back one of their own
	 * old handles.
	 */
	update(userId: string, input: UpdateMe): Promise<MeEntity> {
		return this.db.$transaction(async (tx) => {
			const current = await tx.user.findUniqueOrThrow({
				where: { id: userId },
				select: { handle: true }
			});
			const data: Prisma.UserUpdateInput = {
				name: input.name,
				bio: input.bio,
				showFavorites: input.showFavorites,
				emailOnReview: input.emailOnReview
			};
			if (input.handle && input.handle !== current.handle) {
				const [holder, previous] = await Promise.all([
					tx.user.findUnique({
						where: { handle: input.handle },
						select: { id: true }
					}),
					tx.handleHistory.findUnique({
						where: { oldHandle: input.handle },
						select: { id: true, userId: true }
					})
				]);
				if (holder || (previous && previous.userId !== userId)) {
					throw new ConflictException(`@${input.handle} is taken`);
				}
				if (previous)
					await tx.handleHistory.delete({ where: { id: previous.id } });
				await tx.handleHistory.create({
					data: { userId, oldHandle: current.handle }
				});
				data.handle = input.handle;
			}
			const user = await tx.user.update({
				where: { id: userId },
				data,
				select: SELECT
			});
			return toMe(user);
		}, ISOLATION);
	}

	/**
	 * Deletes the account in one transaction: private quotes go, public ones
	 * stay credited to "a former member" (contributor null), and the quote
	 * counts the member's likes, favorites and recommendations added are taken
	 * back before those rows go with the account. The bootstrap superuser
	 * cannot delete itself.
	 */
	async delete(userId: string, input: DeleteMe) {
		await this.db.$transaction(async (tx) => {
			const user = await tx.user.findUniqueOrThrow({
				where: { id: userId },
				select: { handle: true, role: true }
			});
			if (input.confirm.replace(/^@/, '').toLowerCase() !== user.handle) {
				throw new BadRequestException(
					'Confirm with your handle to delete the account'
				);
			}
			if (hasRole(user.role, 'superuser')) {
				throw new ConflictException('The superuser account cannot be deleted');
			}
			for (const [table, column] of [
				['likes', 'like_count'],
				['favorites', 'favorite_count'],
				['recommendations', 'recommend_count']
			] as const) {
				await tx.$executeRawUnsafe(
					`UPDATE quotes q SET ${column} = GREATEST(q.${column} - 1, 0)
					 FROM ${table} r WHERE r.quote_id = q.id AND r.user_id = $1`,
					userId
				);
			}
			await tx.quote.deleteMany({
				where: { contributorId: userId, type: QuoteType.PRIVATE }
			});
			await tx.user.delete({ where: { id: userId } });
		}, ISOLATION);
	}
}
