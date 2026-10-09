import { Injectable } from '@nestjs/common';
import { UserSession } from '@thallesp/nestjs-better-auth';
import { PrismaService } from 'common/services';
import { MediaService } from 'media/services';
import { FileEntity } from 'media/entity';
import { CurrentUserEntity, toCurrentUser } from '../entity';

@Injectable()
export class CurrentUserService {
	constructor(
		private media: MediaService,
		private db: PrismaService
	) {}

	async updateAvatar(
		user: UserSession['user'],
		file: Express.Multer.File
	): Promise<FileEntity> {
		const image = await this.media.uploadAvatar(file);
		if (user.image) {
			this.media.deleteFile(user.image);
		}
		await this.db.user.update({
			where: { id: user.id },
			data: { image }
		});
		return { path: image };
	}

	/**
	 * Stamp the user's onboarding as complete (idempotent — re-stamps on repeat).
	 * Called when the wizard finishes or is skipped so the first-run gate stops
	 * redirecting them.
	 */
	async completeOnboarding(
		user: UserSession['user']
	): Promise<CurrentUserEntity> {
		const updated = await this.db.user.update({
			where: { id: user.id },
			data: { onboardingCompletedAt: new Date() }
		});
		return toCurrentUser(updated as unknown as UserSession['user']);
	}
}
