import 'dotenv/config';

interface App {
	env: string;
	logLevel: string;
}

interface Database {
	url: string;
}

interface Redis {
	host: string;
	port: number;
	user?: string | undefined;
	password?: string | undefined;
}

interface Puppeteer {
	executablePath: string;
}

interface Config {
	app: App;
	database: Database;
	redis: Redis;
	puppeteer: Puppeteer;
}

const config: Config = {
	app: {
		env: process.env.APP_ENV ?? 'development',
		logLevel: process.env.LOG_LEVEL ?? 'debug'
	},
	database: {
		url: process.env.DATABASE_URL ?? ''
	},
	redis: {
		host: process.env.REDIS_HOST ?? 'localhost',
		port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
		user: process.env.REDIS_USER,
		password: process.env.REDIS_PASSWORD
	},
	// Empty means "let Puppeteer use its bundled Chromium". In a slim container
	// image you install Chromium separately and point this at it.
	puppeteer: {
		executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? ''
	}
};

export default config;
