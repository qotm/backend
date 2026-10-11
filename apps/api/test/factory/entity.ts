import { Factory } from 'fishery';
import { faker as F } from '@faker-js/faker';
import { UserSession } from '@thallesp/nestjs-better-auth';
import { User } from '@qotm/db/client';
import { ok } from 'common/entity';
import { FileEntity } from 'media/entity';

export class Entity {
	static get ok() {
		return ok();
	}

	static get user() {
		return Factory.define<User>(() => ({
			id: F.string.uuid(),
			name: F.person.fullName(),
			email: F.internet.email(),
			image: F.image.avatar(),
			emailVerified: F.datatype.boolean(),
			banned: F.datatype.boolean(),
			banReason: F.lorem.sentence(),
			role: 'user',
			banExpires: null,
			onboardingCompletedAt: null,
			handle: F.string.alphanumeric({ length: 10, casing: 'lower' }),
			bio: null,
			showFavorites: false,
			emailOnReview: true,
			createdAt: new Date(),
			updatedAt: new Date()
		}));
	}

	static get requestUser() {
		return Factory.define<UserSession['user']>(() => ({
			id: F.string.uuid(),
			name: F.person.fullName(),
			email: F.internet.email(),
			image: F.image.avatar(),
			emailVerified: F.datatype.boolean(),
			banned: F.datatype.boolean(),
			banReason: F.lorem.sentence(),
			role: 'user',
			handle: F.string.alphanumeric({ length: 10, casing: 'lower' }),
			banExpires: null,
			createdAt: new Date(),
			updatedAt: new Date()
		}));
	}

	static get userSession() {
		return Factory.define<UserSession>(() => {
			const user = Entity.requestUser.build();
			return {
				user,
				session: {
					id: F.string.uuid(),
					userId: user.id,
					expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
					token: F.string.alphanumeric(16),
					createdAt: new Date(),
					updatedAt: new Date()
				}
			};
		});
	}

	static get file() {
		return Factory.define<FileEntity>(() => ({
			path: F.image.avatar()
		}));
	}
}
