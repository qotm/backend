import { TestBed, type Mocked } from '@suites/unit';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Gen } from '@test/factory/gen';
import { Entity } from '@test/factory/entity';
import { Dto } from '@test/factory/dto';
import { PrismaService } from 'common/services';
import { UsersService } from '../services';
import { PaginatedUserEntity, UserEntity } from '../entity';
import { OKEntity } from 'common/entity';

describe('UsersService', () => {
	let service: UsersService;
	let db: Mocked<PrismaService>;

	beforeAll(async () => {
		const { unit, unitRef } = await TestBed.solitary(UsersService).compile();
		service = unit;
		db = unitRef.get(PrismaService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('paginate', () => {
		beforeEach(() => {
			vi.clearAllMocks();
			// Every role the specs filter by is one some user holds.
			db.x.user.exists.mockResolvedValue(true);
		});

		const currentUser = Entity.requestUser.build({ role: 'admin' });
		const getCallArgs = (): any => db.x.user.paginate.mock.calls[0][0];

		it('should return a PaginatedUserEntity', async () => {
			const users = Entity.user.buildList(3);
			db.x.user.paginate.mockResolvedValue([
				users,
				{ total: 3, currentPage: 1, pageSize: 3, lastPage: 1 }
			]);

			const result = await service.paginate(currentUser, {});
			expect(PaginatedUserEntity.safeParse(result).success).toBe(true);
			expect(result.list).toHaveLength(3);
			expect(result.total).toBe(3);
		});

		it('rejects a role no user holds, with a validation error', async () => {
			db.x.user.exists.mockResolvedValue(false);

			await expect(
				service.paginate(currentUser, Dto.userFilters.build({ role: 'ghost' }))
			).rejects.toThrow(
				new BadRequestException("Validation: role 'ghost' does not exist")
			);
			expect(db.x.user.exists).toHaveBeenCalledWith({
				role: { equals: 'ghost', mode: 'insensitive' }
			});
			expect(db.x.user.paginate).not.toHaveBeenCalled();
		});

		it('skips the role lookup when no role is given', async () => {
			db.x.user.paginate.mockResolvedValue([
				[],
				{ total: 0, currentPage: 1, pageSize: 0, lastPage: 1 }
			]);

			await service.paginate(currentUser, {});
			expect(db.x.user.exists).not.toHaveBeenCalled();
		});

		it('should exclude the current user from results', async () => {
			db.x.user.paginate.mockResolvedValue([
				[],
				{ total: 0, currentPage: 1, pageSize: 0, lastPage: 1 }
			]);

			await service.paginate(currentUser, {});

			const callArgs = getCallArgs();
			expect(callArgs.where.id).toEqual({ not: currentUser.id });
		});

		// The listing is now an allowlist of visible roles rather than a single
		// "not superuser" exclusion, so `moderator` is filterable and superusers
		// are visible to their own tier.
		it('restricts a non-superuser viewer to the non-superuser roles', async () => {
			db.x.user.paginate.mockResolvedValue([
				[],
				{ total: 0, currentPage: 1, pageSize: 0, lastPage: 1 }
			]);

			await service.paginate(currentUser, {});

			const callArgs = getCallArgs();
			expect(callArgs.where.role).toEqual({
				in: ['user', 'moderator', 'admin']
			});
		});

		it('lets a superuser see superusers too', async () => {
			db.x.user.paginate.mockResolvedValue([
				[],
				{ total: 0, currentPage: 1, pageSize: 0, lastPage: 1 }
			]);

			await service.paginate(
				Entity.requestUser.build({ role: 'superuser' }),
				{}
			);

			const callArgs = getCallArgs();
			expect(callArgs.where.role).toEqual({
				in: ['user', 'moderator', 'admin', 'superuser']
			});
		});

		it('should add search filter for name and email when search is provided', async () => {
			db.x.user.paginate.mockResolvedValue([
				[],
				{ total: 0, currentPage: 1, pageSize: 0, lastPage: 1 }
			]);

			await service.paginate(
				currentUser,
				Dto.userFilters.build({ search: 'john' })
			);

			const callArgs = getCallArgs();
			expect(callArgs.where.OR).toEqual([
				{ email: { contains: 'john', mode: 'insensitive' } },
				{ name: { contains: 'john', mode: 'insensitive' } }
			]);
		});

		it('should trim the search string', async () => {
			db.x.user.paginate.mockResolvedValue([
				[],
				{ total: 0, currentPage: 1, pageSize: 0, lastPage: 1 }
			]);

			await service.paginate(
				currentUser,
				Dto.userFilters.build({ search: '  john  ' })
			);

			const callArgs = getCallArgs();
			expect(callArgs.where.OR).toEqual([
				{ email: { contains: 'john', mode: 'insensitive' } },
				{ name: { contains: 'john', mode: 'insensitive' } }
			]);
		});

		it('should skip search filter when search is empty string', async () => {
			db.x.user.paginate.mockResolvedValue([
				[],
				{ total: 0, currentPage: 1, pageSize: 0, lastPage: 1 }
			]);

			await service.paginate(
				currentUser,
				Dto.userFilters.build({ search: '' })
			);

			const callArgs = getCallArgs();
			expect(callArgs.where.OR).toBeUndefined();
		});

		it('should skip search filter when search is only whitespace', async () => {
			db.x.user.paginate.mockResolvedValue([
				[],
				{ total: 0, currentPage: 1, pageSize: 0, lastPage: 1 }
			]);

			await service.paginate(
				currentUser,
				Dto.userFilters.build({ search: '       ' })
			);

			const callArgs = getCallArgs();
			expect(callArgs.where.OR).toBeUndefined();
		});

		it('should filter by role when role is "admin"', async () => {
			db.x.user.paginate.mockResolvedValue([
				[],
				{ total: 0, currentPage: 1, pageSize: 0, lastPage: 1 }
			]);

			await service.paginate(
				currentUser,
				Dto.userFilters.build({ role: 'admin' })
			);

			const callArgs = getCallArgs();
			expect(callArgs.where.role).toBe('admin');
		});

		it('should filter by role when role is "user"', async () => {
			db.x.user.paginate.mockResolvedValue([
				[],
				{ total: 0, currentPage: 1, pageSize: 0, lastPage: 1 }
			]);

			await service.paginate(
				currentUser,
				Dto.userFilters.build({ role: 'user' })
			);

			const callArgs = getCallArgs();
			expect(callArgs.where.role).toBe('user');
		});

		// The security-relevant path: an admin asking for superusers must not get
		// them, and must not get an unfiltered listing either.
		it('falls back to the visible roles when an admin filters by superuser', async () => {
			db.x.user.paginate.mockResolvedValue([
				[],
				{ total: 0, currentPage: 1, pageSize: 0, lastPage: 1 }
			]);

			await service.paginate(
				currentUser,
				Dto.userFilters.build({ role: 'superuser' })
			);

			const callArgs = getCallArgs();
			expect(callArgs.where.role).toEqual({
				in: ['user', 'moderator', 'admin']
			});
		});

		it('honours a superuser filtering by superuser', async () => {
			db.x.user.paginate.mockResolvedValue([
				[],
				{ total: 0, currentPage: 1, pageSize: 0, lastPage: 1 }
			]);

			await service.paginate(
				Entity.requestUser.build({ role: 'superuser' }),
				Dto.userFilters.build({ role: 'superuser' })
			);

			const callArgs = getCallArgs();
			expect(callArgs.where.role).toBe('superuser');
		});

		// Previously the role filter only accepted 'admin' | 'user', so asking for
		// moderators silently returned everyone. That was a bug, not a policy.
		it('should filter by role when role is "moderator"', async () => {
			db.x.user.paginate.mockResolvedValue([
				[],
				{ total: 0, currentPage: 1, pageSize: 0, lastPage: 1 }
			]);

			await service.paginate(
				currentUser,
				Dto.userFilters.build({ role: 'moderator' })
			);

			const callArgs = getCallArgs();
			expect(callArgs.where.role).toBe('moderator');
		});

		it('should pass page and limit to paginate', async () => {
			db.x.user.paginate.mockResolvedValue([
				[],
				{ total: 0, currentPage: 3, pageSize: 0, lastPage: 5 }
			]);

			await service.paginate(
				currentUser,
				Dto.userFilters.build({ page: 3, limit: 5 })
			);

			const callArgs = getCallArgs();
			expect(callArgs.page).toBe(3);
			expect(callArgs.limit).toBe(5);
		});
	});

	describe('getUserById', () => {
		// Takes the whole session user, not just an id: visibility depends on the
		// viewer's role and has to agree with `paginate`.
		const admin = Entity.requestUser.build({ role: 'admin' });
		const superuser = Entity.requestUser.build({ role: 'superuser' });

		it('should throw NotFoundException when looking up own ID', async () => {
			await expect(service.getUserById(admin, admin.id)).rejects.toThrow(
				NotFoundException
			);
		});

		it('should throw NotFoundException when user does not exist', async () => {
			const targetId = Gen.uuid();
			db.user.findFirst.mockResolvedValue(null);

			await expect(service.getUserById(admin, targetId)).rejects.toThrow(
				NotFoundException
			);
		});

		it('hides a superuser from an admin', async () => {
			const targetId = Gen.uuid();
			db.user.findFirst.mockResolvedValue(
				Entity.user.build({ id: targetId, role: 'superuser' })
			);

			await expect(service.getUserById(admin, targetId)).rejects.toThrow(
				NotFoundException
			);
		});

		// The inconsistency this signature change fixed: `paginate` lists
		// superusers to a superuser, so opening one must not 404.
		it('shows a superuser to another superuser', async () => {
			const targetId = Gen.uuid();
			db.user.findFirst.mockResolvedValue(
				Entity.user.build({ id: targetId, role: 'superuser' })
			);

			const result = await service.getUserById(superuser, targetId);
			expect(UserEntity.safeParse(result).success).toBe(true);
			expect(result.role).toBe('superuser');
		});

		it('reads a multi-role viewer, not just an exact match', async () => {
			const targetId = Gen.uuid();
			db.user.findFirst.mockResolvedValue(
				Entity.user.build({ id: targetId, role: 'superuser' })
			);

			const result = await service.getUserById(
				Entity.requestUser.build({ role: 'admin,superuser' }),
				targetId
			);
			expect(UserEntity.safeParse(result).success).toBe(true);
		});

		it('should return UserEntity for a valid user', async () => {
			const targetId = Gen.uuid();
			db.user.findFirst.mockResolvedValue(
				Entity.user.build({ id: targetId, role: 'user' })
			);

			const result = await service.getUserById(admin, targetId);
			expect(UserEntity.safeParse(result).success).toBe(true);
			expect(result.id).toBe(targetId);
		});

		it('should return UserEntity for an admin user', async () => {
			const targetId = Gen.uuid();
			db.user.findFirst.mockResolvedValue(
				Entity.user.build({ id: targetId, role: 'admin' })
			);

			const result = await service.getUserById(admin, targetId);
			expect(UserEntity.safeParse(result).success).toBe(true);
			expect(result.role).toBe('admin');
		});

		it('should query by id', async () => {
			const targetId = Gen.uuid();
			db.user.findFirst.mockResolvedValue(
				Entity.user.build({ id: targetId, role: 'user' })
			);

			await service.getUserById(admin, targetId);

			expect(db.user.findFirst).toHaveBeenCalledWith({
				where: { id: targetId }
			});
		});
	});

	describe('remove', () => {
		it('should delete the user by id', async () => {
			const userId = Gen.uuid();
			db.user.delete.mockResolvedValue(Entity.user.build({ id: userId }));

			await service.remove(userId);

			expect(db.user.delete).toHaveBeenCalledWith({
				where: { id: userId }
			});
		});

		it('should return an OKEntity', async () => {
			const userId = Gen.uuid();
			db.user.delete.mockResolvedValue(Entity.user.build({ id: userId }));

			const result = await service.remove(userId);
			expect(OKEntity.safeParse(result).success).toBe(true);
			expect(result.status).toBe(200);
			expect(result.message).toBe('ok');
		});
	});
});
