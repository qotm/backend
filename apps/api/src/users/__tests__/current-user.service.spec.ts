import { TestBed, type Mocked } from '@suites/unit';
import { Entity } from '@test/factory/entity';
import { PrismaService } from 'common/services';
import { MediaService } from 'media/services';
import { FileEntity } from 'media/entity';
import { CurrentUserService } from '../services';
import { CurrentUserEntity } from '../entity';

describe('CurrentUserService', () => {
	let service: CurrentUserService;
	let media: Mocked<MediaService>;
	let db: Mocked<PrismaService>;

	beforeAll(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(CurrentUserService).compile();
		service = unit;
		media = unitRef.get(MediaService);
		db = unitRef.get(PrismaService);
	});

	beforeEach(() => {
		media.uploadAvatar.mockReset();
		media.deleteFile.mockReset();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('completeOnboarding', () => {
		it('stamps onboardingCompletedAt on the session user', async () => {
			const user = Entity.requestUser.build();
			db.user.update.mockResolvedValue(
				Entity.user.build({ id: user.id, onboardingCompletedAt: new Date() })
			);

			await service.completeOnboarding(user);

			expect(db.user.update).toHaveBeenCalledWith({
				where: { id: user.id },
				data: { onboardingCompletedAt: expect.any(Date) }
			});
		});

		it('returns the updated user as a CurrentUserEntity', async () => {
			const user = Entity.requestUser.build();
			const at = new Date('2026-04-05T06:07:08.000Z');
			db.user.update.mockResolvedValue(
				Entity.user.build({ id: user.id, onboardingCompletedAt: at })
			);

			const result = await service.completeOnboarding(user);

			expect(result.id).toBe(user.id);
			expect(result.onboardingCompletedAt).toBe(at);
			expect(CurrentUserEntity.safeParse(result).success).toBe(true);
		});
	});

	describe('updateAvatar', () => {
		const file = {
			originalname: 'avatar.png',
			buffer: Buffer.from('image-data'),
			mimetype: 'image/png'
		} as Express.Multer.File;

		it('should upload the file via MediaService', async () => {
			const user = Entity.user.build({ image: null });
			const newImageUrl = 'http://s3.example.com/avatars/new.png';
			media.uploadAvatar.mockResolvedValue(newImageUrl);
			db.user.update.mockResolvedValue(user);
			await service.updateAvatar(
				Entity.requestUser.build({ id: user.id }),
				file
			);
			expect(media.uploadAvatar).toHaveBeenCalledWith(file);
		});

		it('should update the user record with the new image URL', async () => {
			const user = Entity.user.build({ image: null });
			const newImageUrl = 'http://s3.example.com/avatars/new.png';
			media.uploadAvatar.mockResolvedValue(newImageUrl);
			db.user.update.mockResolvedValue(user);

			await service.updateAvatar(
				Entity.requestUser.build({ id: user.id }),
				file
			);

			expect(db.user.update).toHaveBeenCalledWith({
				where: { id: user.id },
				data: { image: newImageUrl }
			});
		});

		it('should return a FileEntity with the new image path', async () => {
			const user = Entity.user.build({ image: null });
			const newImageUrl = 'http://s3.example.com/avatars/new.png';
			media.uploadAvatar.mockResolvedValue(newImageUrl);
			db.user.update.mockResolvedValue(user);

			const result = await service.updateAvatar(
				Entity.requestUser.build(),
				file
			);

			expect(FileEntity.safeParse(result).success).toBe(true);
			expect(result.path).toBe(newImageUrl);
		});

		it('should delete the old avatar when user already has an image', async () => {
			const oldImageUrl = 'http://s3.example.com/avatars/old.png';
			const user = Entity.user.build({ image: oldImageUrl });
			const newImageUrl = 'http://s3.example.com/avatars/new.png';
			media.uploadAvatar.mockResolvedValue(newImageUrl);
			db.user.update.mockResolvedValue(user);

			await service.updateAvatar(
				Entity.requestUser.build({ id: user.id, image: oldImageUrl }),
				file
			);

			expect(media.deleteFile).toHaveBeenCalledWith(oldImageUrl);
		});

		it('should NOT delete old avatar when user has no existing image', async () => {
			const user = Entity.user.build({ image: null });
			const newImageUrl = 'http://s3.example.com/avatars/new.png';
			media.uploadAvatar.mockResolvedValue(newImageUrl);
			db.user.update.mockResolvedValue(user);

			await service.updateAvatar(
				Entity.requestUser.build({ id: user.id, image: null }),
				file
			);

			expect(media.deleteFile).not.toHaveBeenCalled();
		});

		it('should NOT delete old avatar when user image is empty string', async () => {
			const user = Entity.user.build({ image: '' });
			const newImageUrl = 'http://s3.example.com/avatars/new.png';
			media.uploadAvatar.mockResolvedValue(newImageUrl);
			db.user.update.mockResolvedValue(user);

			await service.updateAvatar(
				Entity.requestUser.build({ id: user.id, image: '' }),
				file
			);

			expect(media.deleteFile).not.toHaveBeenCalled();
		});
	});
});
