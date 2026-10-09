import 'dotenv/config';

export const SUPER_USER = {
	name: 'Super User',
	email: process.env.SUPERUSER_EMAIL || 'superuser@example.com',
	password: process.env.SUPERUSER_PASSWORD || 'Secret@1',
	role: 'superuser'
};

export const TEST_ADMIN = {
	name: 'Test Admin',
	email: 'test.admin@example.com',
	password: 'secret',
	role: 'admin'
};

export const TEST_USER = {
	name: 'Test User',
	email: 'test.user@example.com',
	password: 'secret',
	role: 'user'
};
