import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { resolve } from 'path';

export default defineConfig({
	plugins: [swc.vite({ module: { type: 'es6' } })],
	resolve: {
		tsconfigPaths: true,
		alias: {
			src: resolve(__dirname, 'src'),
			'@emails': resolve(__dirname, '__mocks__'),
			'@test': resolve(__dirname, 'test'),
			'@seeders': resolve(__dirname, 'seeders')
		}
	},
	test: {
		globals: true,
		setupFiles: ['test/setup.ts'],
		testTimeout: 30000,
		coverage: {
			provider: 'v8',
			reportsDirectory: 'coverage/vitest',
			reporter: ['text', 'json', 'lcov', 'html']
		},
		projects: [
			{
				extends: true,
				test: {
					name: { label: 'unit', color: 'yellow' },
					include: ['src/**/*.spec.ts']
				}
			},
			{
				extends: true,
				test: {
					name: { label: 'e2e', color: 'red' },
					include: ['test/**/*.spec.ts'],
					// e2e shares one database, so specs must run strictly serially —
					// a single worker AND no file-level parallelism. Otherwise two
					// refresh() cycles (truncate + reseed) overlap and deadlock.
					maxWorkers: 1,
					fileParallelism: false,
					// refresh() truncates + fully reseeds (incl. password hashing for
					// seeded users) before every spec; on slow CI runners that
					// exceeds the 10s default hook timeout. Give it real headroom.
					hookTimeout: 120000,
					testTimeout: 60000
				}
			}
		]
	}
});
