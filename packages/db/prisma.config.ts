import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// DATABASE_URL comes from the calling app's env: the API's `db:*` scripts run
// Prisma here through `dotenv -e .env --`, because the API owns the database.
export default defineConfig({
	schema: 'prisma/schema',
	migrations: {
		path: 'prisma/migrations'
	},
	datasource: {
		url: process.env['DATABASE_URL'] || ''
	}
});
