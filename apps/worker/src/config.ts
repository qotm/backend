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

interface S3 {
	endpoint: string;
	region: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
}

interface Releases {
	/** Key prefix in the bucket, served as the releases host's root. */
	prefix: string;
	/** Public URL of that prefix: `https://releases.qotm.dev` in production. */
	baseUrl: string;
}

interface Config {
	app: App;
	database: Database;
	redis: Redis;
	puppeteer: Puppeteer;
	s3: S3;
	releases: Releases;
}

const s3: S3 = {
	endpoint: process.env.S3_ENDPOINT ?? '',
	region: process.env.S3_REGION || 'us-east-1',
	bucket: process.env.S3_BUCKET_NAME ?? '',
	accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
	secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? ''
};
const releasesPrefix = process.env.RELEASES_PREFIX || 'releases';

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
	},
	s3,
	releases: {
		prefix: releasesPrefix,
		// Defaults to the bucket's own path-style URL (development).
		baseUrl: (
			process.env.RELEASES_BASE_URL ||
			`${s3.endpoint}/${s3.bucket}/${releasesPrefix}`
		).replace(/\/+$/, '')
	}
};

export default config;
