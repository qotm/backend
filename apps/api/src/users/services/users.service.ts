import { Injectable, NotFoundException } from '@nestjs/common';
import { UserSession } from '@thallesp/nestjs-better-auth';
import { Prisma } from '@qotm/db/client';
import { PrismaService } from 'common/services';
import { ensureExists } from 'common/utils';
import { hasRole, type RoleInput } from 'lib/access';
import { PaginatedUserEntity, UserEntity } from '../entity';
import { UserFilters } from '../dto';
import { ok } from 'common/entity';

const SU = 'superuser';

/**
 * Roles a viewer may see. Superusers are visible only to their own tier —
 * everyone below sees user / moderator / admin.
 */
const visibleRolesFor = (role: RoleInput): string[] =>
	hasRole(role, SU)
		? ['user', 'moderator', 'admin', SU]
		: ['user', 'moderator', 'admin'];

@Injectable()
export class UsersService {
	constructor(private db: PrismaService) {}

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
				{ name: { contains: search, mode: 'insensitive' } }
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
			page: filters.page,
			limit: filters.limit
		});

		return { list, ...meta };
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
		await this.db.user.delete({ where: { id } });
		return ok();
	}
}
