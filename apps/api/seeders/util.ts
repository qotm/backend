import 'dotenv/config';
import { auth } from '../src/lib/auth';
import { PrismaClient } from '@qotm/db/client';
import { TOPICS } from './topics';
import { seedDevelopmentData } from './dev';

interface Admin {
	email: string;
	password: string;
}

/**
 * Database seeder.
 *
 * Users are created through better-auth's own API rather than by inserting rows
 * directly — password hashing, account linking and role assignment all live
 * there, and a hand-written `user` row cannot sign in.
 *
 * Add reference-data seeds as private methods and call them from `seed()`.
 * Anything only tests need goes behind the `isTest` flag.
 */
class Seeder {
	private constructor(private readonly db: PrismaClient) {}

	get instance() {
		return this.db;
	}

	static setup(db: PrismaClient) {
		return new Seeder(db);
	}

	/**
	 * Idempotent: everything is found by a natural key and skipped when it
	 * exists. `withSamples` adds the design's sample content (development
	 * only, never test or production).
	 */
	async seed(admin: Admin, isTest = false, withSamples = false) {
		await this.seedTopics();
		await this.seedSuperuser(admin);

		if (isTest) {
			await this.seedTestUsers();
		}
		if (withSamples) {
			await seedDevelopmentData(this.db);
		}
	}

	private async exists(email: string) {
		return Boolean(await this.db.user.findUnique({ where: { email } }));
	}

	/** The fixed taxonomy. Upserted, so a re-run adds missing topics only. */
	private async seedTopics() {
		for (const topic of TOPICS) {
			await this.db.topic.upsert({
				where: { slug: topic.slug },
				create: topic,
				update: {}
			});
		}
	}

	private async seedSuperuser(admin: Admin) {
		if (await this.exists(admin.email)) return;
		await auth.api.createUser({
			body: {
				name: 'Super User',
				email: admin.email,
				password: admin.password,
				role: 'superuser'
			}
		});
		await this.db.user.update({
			where: { email: admin.email },
			data: { emailVerified: true }
		});
	}

	private async seedTestUsers() {
		const users = [
			{
				name: 'Test Admin',
				email: 'test.admin@example.com',
				password: 'secret',
				role: 'admin' as const
			},
			{
				name: 'Test User',
				email: 'test.user@example.com',
				password: 'secret',
				role: 'member' as const
			}
		];

		for (const user of users) {
			if (await this.exists(user.email)) continue;
			await auth.api.createUser({
				body: {
					name: user.name,
					email: user.email,
					password: user.password,
					role: user.role
				}
			});
		}

		await this.db.user.updateMany({
			where: { email: { in: users.map((u) => u.email) } },
			data: { emailVerified: true }
		});
	}
}

export default Seeder;
