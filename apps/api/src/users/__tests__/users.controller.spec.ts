import { TestBed, type Mocked } from '@suites/unit';
import { Entity } from '@test/factory/entity';
import { Gen } from '@test/factory/gen';
import { UsersController } from '../controllers';
import { UsersService } from '../services';
import type { PaginatedUserEntity } from '../entity';

describe('UsersController', () => {
	let controller: UsersController;
	let service: Mocked<UsersService>;

	beforeAll(async () => {
		const { unit, unitRef } = await TestBed.solitary(UsersController).compile();
		controller = unit;
		service = unitRef.get(UsersService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('findAll', () => {
		it('should delegate to UsersService.paginate with user and filters', async () => {
			const user = Entity.user.build({ role: 'admin' });
			const filters = { page: 1, limit: 10 };
			const paginated: PaginatedUserEntity = {
				list: Entity.user.buildList(2),
				total: 2,
				currentPage: 1,
				lastPage: 1,
				pageSize: 2
			};
			service.paginate.mockResolvedValue(paginated);

			const result = await controller.findAll(filters, { user } as any);

			expect(service.paginate).toHaveBeenCalledWith(user, filters);
			expect(result).toBe(paginated);
		});

		it('should pass search and role filters through', async () => {
			const user = Entity.user.build({ role: 'admin' });
			const filters = { search: 'john', role: 'user', page: 2, limit: 5 };
			const paginated: PaginatedUserEntity = {
				list: [],
				total: 0,
				currentPage: 2,
				lastPage: 0,
				pageSize: 0
			};
			service.paginate.mockResolvedValue(paginated);

			await controller.findAll(filters, { user } as any);

			expect(service.paginate).toHaveBeenCalledWith(user, filters);
		});
	});

	describe('findOne', () => {
		// Passes the whole session user, not just its id — visibility depends on
		// the viewer's role (see UsersService.getUserById).
		it('should delegate to UsersService.getUserById with the session user and target id', async () => {
			const currentUserId = Gen.uuid();
			const targetId = Gen.uuid();
			const user = Entity.user.build({ id: currentUserId, role: 'admin' });
			const target = Entity.user.build({ id: targetId, role: 'user' });
			service.getUserById.mockResolvedValue(target);

			const result = await controller.findOne(targetId, {
				user
			} as any);

			expect(service.getUserById).toHaveBeenCalledWith(user, targetId);
			expect(result).toBe(target);
		});

		it('should propagate NotFoundException from service', async () => {
			const currentUserId = Gen.uuid();
			const user = Entity.user.build({ id: currentUserId, role: 'admin' });
			service.getUserById.mockRejectedValue(
				new (await import('@nestjs/common')).NotFoundException()
			);

			await expect(
				controller.findOne(Gen.uuid(), { user } as any)
			).rejects.toThrow('Not Found');
		});
	});
});
