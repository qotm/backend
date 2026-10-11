import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@qotm/db/client';
import Seeder from './util';

const prisma = new PrismaClient({
	adapter: new PrismaPg({
		connectionString: process.env.DATABASE_URL
	})
});

(async () => {
	const env = process.env.APP_ENV;
	const email = process.env.SUPERUSER_EMAIL;
	const password = process.env.SUPERUSER_PASSWORD;
	if (!email || !password) {
		throw Error('Missing admin credentials');
	}
	await Seeder.setup(prisma).seed(
		{ email, password },
		env === 'test',
		env === 'development'
	);
})()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
