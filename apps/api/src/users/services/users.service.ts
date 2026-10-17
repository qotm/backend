import {
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common';
import { UserSession } from '@thallesp/nestjs-better-auth';
import { Prisma } from '@qotm/db/client';
import { QuoteType } from '@qotm/db/enums';
import { PrismaService } from 'common/services';
import { ensureExists } from 'common/utils';
import { recordAudit } from 'audit';
import { DEFAULT_ROLE, hasRole, roles, type RoleInput } from 'lib/access';
import { CURATED_STATUSES } from 'quotes/visibility';
import { ShareImagesService } from 'share/services';
import { PaginatedUserEntity, UserEntity } from '../entity';
import { UserFilters, type SetRole } from '../dto';
import { PUBLIC_CONTRIBUTION } from './profiles.service';

type AssignableRole = SetRole['role'];
import { ok } from 'common/entity';

const SU = 'superuser';

const ALL_ROLES = Object.keys(roles);

/**
 * Roles a viewer may see. Superusers are visible only to their own tier —
 * everyone below sees member / verifier / moderator / admin.
 */
const visibleRolesFor = (role: RoleInput): string[] =>
	hasRole(role, SU) ? ALL_ROLES : ALL_ROLES.filter((name) => name !== SU);

@Injectable()
export class UsersService {
	constructor(
		private db: PrismaService,
		private share: ShareImagesService
	) {}

	async paginate(
		user: UserSession['user'],
		filters: UserFilters
	): Promise<PaginatedUserEntity> {
		await ensureExists(this.db, 'user', 'role', filters.role);

		const where: Prisma.UserWhereInput = {
			id: { not: user.id }
		};
		if (filters.search && filters.search.trim() !== '') {
			const search = filters.search.trim();
			where.OR = [
				{ email: { contains: search, mode: 'insensitive' } },
				{ name: { contains: search, mode: 'insensitive' } },
				{ handle: { contains: search.replace(/^@/, ''), mode: 'insensitive' } }
			];
		}

		// `hasRole`, not `user.role === SU`: better-auth stores role as a
		// comma-separated string, so a user holding "admin,superuser" fails a
		// straight equality. See `lib/access.ts`.
		const visibleRoles = visibleRolesFor(user.role);

		// An out-of-range role (a non-superuser asking for superusers) narrows to
		// the whole visible set rather than leaking — never to an unfiltered list.
		where.role =
			filters.role && visibleRoles.includes(filters.role)
				? filters.role
				: { in: visibleRoles };

		const [list, meta] = await this.db.x.user.paginate({
			where,
			orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
			page: filters.page,
			limit: filters.limit
		});

		const ids = list.map((u) => u.id);
		const count = async (where: Prisma.QuoteWhereInput) => {
			const rows = await this.db.quote.groupBy({
				by: ['contributorId'],
				// The profile's own definition, for the whole page of users at once.
				where: {
					...PUBLIC_CONTRIBUTION(''),
					contributorId: { in: ids },
					...where
				},
				_count: { _all: true }
			});
			return new Map(rows.map((r) => [r.contributorId, r._count._all]));
		};
		const [contributions, curated] = ids.length
			? await Promise.all([
					count({}),
					count({ status: { in: [...CURATED_STATUSES] } })
				])
			: [new Map(), new Map()];

		return {
			list: list.map((u) => ({
				...u,
				contributions: contributions.get(u.id) ?? 0,
				curated: curated.get(u.id) ?? 0
			})),
			...meta
		};
	}

	/**
	 * Assigns a role (`member`, `verifier`, `moderator` or `admin`; never
	 * `superuser`), audited as "member → moderator". The superuser's own role
	 * is fixed, and the last admin cannot be demoted: the admins' rows are
	 * locked first, so two admins demoting each other at once cannot both
	 * succeed. Their sessions read the role from the database, so the change
	 * applies on their next request.
	 */
	async setRole(
		viewer: UserSession['user'],
		id: string,
		role: AssignableRole
	): Promise<UserEntity> {
		await this.db.$transaction(
			async (tx) => {
				const admins = await tx.$queryRaw<{ id: string; role: string }[]>`
					SELECT id, role FROM "user" WHERE role LIKE '%admin%' FOR UPDATE`;
				const target = await tx.user.findUnique({ where: { id } });
				// 404, not 403: a hidden user (a superuser, to an admin) is not
				// confirmed to exist.
				if (
					!target ||
					!visibleRolesFor(viewer.role).includes(target.role ?? DEFAULT_ROLE)
				) {
					throw new NotFoundException();
				}
				if (hasRole(target.role, SU)) {
					throw new ConflictException('The superuser’s role cannot change');
				}
				const from = target.role ?? DEFAULT_ROLE;
				if (from === role) return;

				const adminCount = admins.filter(
					(u) => hasRole(u.role, 'admin') && !hasRole(u.role, SU)
				).length;
				if (hasRole(from, 'admin') && adminCount <= 1) {
					throw new ConflictException('The last admin cannot be demoted');
				}

				await tx.user.update({ where: { id }, data: { role } });
				await recordAudit(tx, {
					actor: {
						id: viewer.id,
						handle: (viewer as typeof viewer & { handle: string }).handle
					},
					action: 'user.role_changed',
					target: { type: 'user', id: target.handle },
					note: `${from} → ${role}`
				});
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
		);
		return this.db.user.findUniqueOrThrow({ where: { id } });
	}

	/**
	 * Takes the whole session user, not just an id, because visibility depends on
	 * the viewer's role — it has to agree with {@link paginate}. Before, a
	 * superuser could see other superusers in the listing and then 404 opening
	 * one, which is what the admin drawer does on row click.
	 */
	async getUserById(
		viewer: UserSession['user'],
		id: string
	): Promise<UserEntity> {
		if (viewer.id === id) throw new NotFoundException();
		const user = await this.db.user.findFirst({ where: { id } });
		if (!user) throw new NotFoundException();
		// 404 rather than 403 — a hidden user shouldn't be confirmed to exist.
		if (!visibleRolesFor(viewer.role).includes(user.role ?? 'user')) {
			throw new NotFoundException();
		}
		return user;
	}

	async remove(id: string) {
		const originals = await this.db.quote.findMany({
			where: { contributorId: id, type: QuoteType.ORIGINAL },
			select: { id: true }
		});
		await this.db.user.delete({ where: { id } });
		// Their originals stay, now credited to "a former member".
		await this.share.rerenderMany({ id: { in: originals.map((q) => q.id) } });
		return ok();
	}
}
