import { z } from 'zod';
import { UserSession } from '@thallesp/nestjs-better-auth';
import { faker as F } from '@faker-js/faker';
import { dateTime, email } from 'common/schemas';
import { paginated } from 'common/entity';

export const UserEntity = z
	.object({
		id: z.string(),
		name: z.string().meta({ example: F.person.fullName() }),
		email: email(),
		emailVerified: z.boolean(),
		image: z.string().nullable().meta({ example: F.image.avatar() }),
		createdAt: dateTime(),
		updatedAt: dateTime(),
		role: z.string().nullable().meta({ example: 'user' }),
		banned: z.boolean().nullable().meta({ example: false }),
		banReason: z.string().nullable().meta({ example: 'Violation of terms' }),
		banExpires: dateTime().nullable(),
		onboardingCompletedAt: dateTime().nullable()
	})
	.meta({ id: 'UserEntity' });
/** What a service hands back; the schema turns it into the response. */
export type UserEntity = z.input<typeof UserEntity>;

export const PaginatedUserEntity = paginated(UserEntity, 'PaginatedUserEntity');
export type PaginatedUserEntity = z.input<typeof PaginatedUserEntity>;

export const CurrentUserEntity = UserEntity.omit({
	banned: true,
	banReason: true,
	banExpires: true
}).meta({ id: 'CurrentUserEntity' });
export type CurrentUserEntity = z.input<typeof CurrentUserEntity>;

/** Shape a better-auth session user into a {@link CurrentUserEntity}. */
export function toCurrentUser(user: UserSession['user']): CurrentUserEntity {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		emailVerified: user.emailVerified,
		image: user.image || null,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
		// better-auth may hand back several roles; the first is the primary one.
		role: (Array.isArray(user.role) ? user.role[0] : user.role) || null,
		// additionalField — not present on the inferred session-user type.
		onboardingCompletedAt:
			(user as { onboardingCompletedAt?: Date | null }).onboardingCompletedAt ??
			null
	};
}
