import { TestBed, type Mocked } from '@suites/unit';
import { Entity } from '@test/factory/entity';
import { CurrentUserController } from '../controllers';
import { CurrentUserService } from '../services';
import { CurrentUserEntity, toCurrentUser } from '../entity';

describe('CurrentUserController', () => {
	let controller: CurrentUserController;
	let service: Mocked<CurrentUserService>;

	beforeAll(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			CurrentUserController
		).compile();
		controller = unit;
		service = unitRef.get(CurrentUserService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('completeOnboarding', () => {
		it('delegates to CurrentUserService with the session user', async () => {
			const session = Entity.userSession.build();
			const updated = toCurrentUser(session.user);
			service.completeOnboarding.mockResolvedValue(updated);

			const result = await controller.completeOnboarding(session);

			expect(service.completeOnboarding).toHaveBeenCalledWith(session.user);
			expect(result).toBe(updated);
		});
	});

	describe('getCurrentUser', () => {
		it('should return a CurrentUserEntity from session user', () => {
			const session = Entity.userSession.build();
			const result = controller.getCurrentUser(session);

			expect(CurrentUserEntity.safeParse(result).success).toBe(true);
			expect(result.id).toBe(session.user.id);
			expect(result.name).toBe(session.user.name);
			expect(result.email).toBe(session.user.email);
		});
	});

	describe('updateAvatar', () => {
		const file = {
			originalname: 'photo.jpg',
			buffer: Buffer.from('photo-data'),
			mimetype: 'image/jpeg'
		} as Express.Multer.File;

		it('should delegate to CurrentUserService.updateAvatar', async () => {
			const session = Entity.userSession.build();
			const fileEntity = Entity.file.build();
			service.updateAvatar.mockResolvedValue(fileEntity);

			const result = await controller.updateAvatar(session, file);

			expect(service.updateAvatar).toHaveBeenCalledWith(session.user, file);
			expect(result).toBe(fileEntity);
		});

		it('should pass the session user and uploaded file to the service', async () => {
			const session = Entity.userSession.build();
			const fileEntity = Entity.file.build();
			service.updateAvatar.mockResolvedValue(fileEntity);
			await controller.updateAvatar(session, file);

			expect(service.updateAvatar).toHaveBeenCalledWith(session.user, file);
		});
	});
});
