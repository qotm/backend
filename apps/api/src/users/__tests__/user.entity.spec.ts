import { Entity } from '@test/factory/entity';
import {
	UserEntity,
	PaginatedUserEntity,
	CurrentUserEntity,
	toCurrentUser
} from '../entity';

// `.parse()` runs a schema in the direction the serializer does: what a service
// returns (Dates and all) in, the JSON response body out.

describe('UserEntity', () => {
	it('serializes every User field, dates as ISO strings', () => {
		const data = Entity.user.build();
		const body = UserEntity.parse(data);

		expect(body).toEqual({
			...data,
			// Emails go out lower-cased, as EmailProperty did.
			email: data.email.toLowerCase(),
			createdAt: data.createdAt.toISOString(),
			updatedAt: data.updatedAt.toISOString(),
			banExpires: null,
			onboardingCompletedAt: null
		});
	});

	it('serializes a set ban expiry as an ISO string', () => {
		const banExpires = new Date('2026-05-01T12:00:00.000Z');
		const body = UserEntity.parse(Entity.user.build({ banExpires }));

		expect(body.banExpires).toBe('2026-05-01T12:00:00.000Z');
	});

	it('keeps null image and ban fields', () => {
		const body = UserEntity.parse(
			Entity.user.build({
				image: null,
				banned: null,
				banReason: null,
				banExpires: null
			})
		);

		expect(body.image).toBeNull();
		expect(body.banned).toBeNull();
		expect(body.banReason).toBeNull();
		expect(body.banExpires).toBeNull();
	});

	it('drops fields the schema does not declare', () => {
		const body = UserEntity.parse({
			...Entity.user.build(),
			passwordHash: 'secret'
		});

		expect(body).not.toHaveProperty('passwordHash');
	});

	it('rejects a row that does not match, rather than sending it', () => {
		const result = UserEntity.safeParse({
			...Entity.user.build(),
			createdAt: 'not a date'
		});

		expect(result.success).toBe(false);
	});
});

describe('PaginatedUserEntity', () => {
	it('carries the pagination meta and serializes each item', () => {
		const users = Entity.user.buildList(3);
		const body = PaginatedUserEntity.parse({
			list: users,
			total: 10,
			currentPage: 2,
			lastPage: 4,
			pageSize: 3
		});

		expect(body).toMatchObject({
			total: 10,
			currentPage: 2,
			lastPage: 4,
			pageSize: 3
		});
		expect(body.list).toHaveLength(3);
		body.list.forEach((item, i) => {
			expect(item.id).toBe(users[i].id);
			expect(item.createdAt).toBe(users[i].createdAt.toISOString());
		});
	});

	it('handles an empty page', () => {
		const body = PaginatedUserEntity.parse({
			list: [],
			total: 0,
			currentPage: 1,
			lastPage: 1,
			pageSize: 0
		});

		expect(body.list).toHaveLength(0);
		expect(body.total).toBe(0);
	});
});

describe('toCurrentUser', () => {
	it('maps the session user fields', () => {
		const sessionUser = Entity.requestUser.build({
			emailVerified: true,
			role: 'admin'
		});
		const user = toCurrentUser(sessionUser);

		expect(user).toMatchObject({
			id: sessionUser.id,
			name: sessionUser.name,
			email: sessionUser.email,
			emailVerified: true,
			image: sessionUser.image,
			createdAt: sessionUser.createdAt,
			updatedAt: sessionUser.updatedAt,
			onboardingCompletedAt: null
		});
	});

	it('sets image to null when the session user has none', () => {
		expect(
			toCurrentUser(Entity.requestUser.build({ image: '' })).image
		).toBeNull();
		expect(
			toCurrentUser(Entity.requestUser.build({ image: undefined })).image
		).toBeNull();
	});

	it('uses a string role as is', () => {
		expect(
			toCurrentUser(Entity.requestUser.build({ role: 'admin' })).role
		).toBe('admin');
	});

	it('takes the first role when better-auth returns several', () => {
		const sessionUser = Entity.requestUser.build({
			role: ['superuser', 'admin'] as unknown as string
		});
		expect(toCurrentUser(sessionUser).role).toBe('superuser');
	});

	it('sets role to null when there is none', () => {
		expect(
			toCurrentUser(Entity.requestUser.build({ role: undefined })).role
		).toBeNull();
	});

	it('carries onboardingCompletedAt when the session has it', () => {
		const at = new Date('2026-02-03T04:05:06.000Z');
		const sessionUser = {
			...Entity.requestUser.build(),
			onboardingCompletedAt: at
		};
		expect(toCurrentUser(sessionUser).onboardingCompletedAt).toBe(at);
	});

	it('serializes through CurrentUserEntity without the ban fields', () => {
		const body = CurrentUserEntity.parse(
			toCurrentUser(Entity.requestUser.build())
		);

		expect(body).not.toHaveProperty('banned');
		expect(body).not.toHaveProperty('banReason');
		expect(body).not.toHaveProperty('banExpires');
		expect(typeof body.createdAt).toBe('string');
	});
});
