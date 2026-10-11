/**
 * Resets the test database (and the test Redis) to a known state for the
 * web app's Playwright suite: `yarn test:db:seed:e2e`. Every table is
 * emptied, then the topics, the superuser, the test users (password
 * sign-in is on in the test environment) and the design's sample content
 * are seeded. Refuses anything but the test stack.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@qotm/db/client';
import Redis from 'ioredis';
import Seeder from './util';

const { DATABASE_URL, APP_ENV, SUPERUSER_EMAIL, SUPERUSER_PASSWORD } =
	process.env;

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: DATABASE_URL })
});

(async () => {
	if (APP_ENV !== 'test' || !DATABASE_URL?.includes(':5461/')) {
		throw Error('seed:e2e only runs against the test stack (.env.test)');
	}
	if (!SUPERUSER_EMAIL || !SUPERUSER_PASSWORD) {
		throw Error('Missing admin credentials');
	}

	const tables = await prisma.$queryRaw<{ tablename: string }[]>`
		SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
	const names = tables
		.map((t) => t.tablename)
		.filter((name) => name !== '_prisma_migrations')
		.map((name) => `"public"."${name}"`)
		.join(', ');
	await prisma.$executeRawUnsafe(
		`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`
	);

	const redis = new Redis({
		host: process.env.REDIS_HOST,
		port: Number(process.env.REDIS_PORT),
		username: process.env.REDIS_USER || undefined,
		password: process.env.REDIS_PASSWORD || undefined
	});
	await redis.flushall();
	redis.disconnect();

	await Seeder.setup(prisma).seed(
		{ email: SUPERUSER_EMAIL, password: SUPERUSER_PASSWORD },
		true,
		true
	);
	console.log('e2e database seeded');
})()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
