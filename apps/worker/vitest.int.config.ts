import { defineConfig } from 'vitest/config';

// Integration tests: real Postgres (the API's test database) and the S3
// bucket, from .env.test. Run with `yarn test:int`, never alongside the
// API's e2e suite (both reset the same tables).
export default defineConfig({
	test: {
		include: ['src/**/*.int.spec.ts'],
		globals: false,
		fileParallelism: false,
		testTimeout: 60_000,
		hookTimeout: 60_000
	},
	resolve: {
		conditions: ['development']
	}
});
