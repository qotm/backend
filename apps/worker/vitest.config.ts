import { defineConfig } from 'vitest/config';

// Unit tests only: they take their database as a parameter and run without
// Postgres or Redis, so CI's `turbo run test` needs no services.
export default defineConfig({
	test: {
		include: ['src/**/*.spec.ts'],
		exclude: ['src/**/*.int.spec.ts', 'node_modules/**'],
		globals: false
	},
	resolve: {
		conditions: ['development']
	}
});
