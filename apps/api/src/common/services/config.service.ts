import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

/**
 * The single door onto the environment.
 *
 * App code must never read `process.env` directly — go through the injected
 * `CustomConfigService` instead. Everything is validated once, at boot, against
 * the Zod `schema`, so a missing variable fails the process immediately rather
 * than surfacing as `undefined` deep inside a request.
 *
 * Adding a variable means three edits in this file: the interface, the Zod
 * schema, and `getVariables` — plus a line in `.env.example`.
 */
namespace Config {
	export interface App {
		name: string;
		twofaAppName: string;
		env: string;
		host: string;
		appHost: string;
		frontendHost: string;
		miscCorsOrigins?: string;
		port: number;
		key: string;
		/** IndexNow's key; empty turns the pings off. The web serves it at /<key>.txt. */
		indexNowKey: string;
	}

	export interface Logger {
		level: string;
	}

	/** Limits past which /health reports the process as down. */
	export interface Health {
		heapMaxMb: number;
		rssMaxMb: number;
		/** Fraction of `diskPath`'s volume that may be used, 0–1. */
		diskThreshold: number;
		diskPath: string;
	}

	export interface Database {
		url: string;
	}

	export interface Redis {
		host: string;
		port: number;
		username?: string;
		password?: string;
	}

	export interface BasicAuth {
		user: string;
		password: string;
	}

	export interface BetterAuth {
		secret: string;
		url: string;
		cookieDomain: string;
		cookiePrefix: string;
		/**
		 * Email + password sign-in. Off everywhere but the test environment:
		 * qotm signs in with magic links and OAuth only (QOT-35), and the e2e
		 * suite signs its seeded users in with passwords.
		 */
		passwordEnabled: boolean;
	}

	export interface Superuser {
		email: string;
		username: string;
		password: string;
	}

	export interface SMTP {
		host: string;
		port: number;
		user: string;
		password: string;
		from: string;
		supportEmail: string;
		secure: boolean;
	}

	export interface S3 {
		accessKeyId: string;
		secretAccessKey: string;
		endpoint: string;
		bucket: string;
		region: string;
	}

	export interface Releases {
		/** Public URL of the bucket's `releases/` prefix (https://releases.qotm.dev). */
		baseUrl: string;
	}

	export interface RateLimit {
		enabled: boolean;
		ttl: number;
		limit: number;
		authWindow: number;
		authMax: number;
		ipHeaders: string[];
	}

	export interface OAuthGoogle {
		clientId: string;
		clientSecret: string;
	}

	export interface OAuth {
		google: OAuthGoogle;
		github: OAuthGoogle;
	}

	export interface Env {
		app: App;
		logger: Logger;
		health: Health;
		database: Database;
		redis: Redis;
		basicAuth: BasicAuth;
		betterAuth: BetterAuth;
		superuser: Superuser;
		smtp: SMTP;
		s3: S3;
		releases: Releases;
		rateLimit: RateLimit;
		oauth: OAuth;
	}

	const { env } = process;

	// Env primitives: a required string must be non-empty, and a number arrives
	// as text that must parse (a blank is an error, not 0).
	const str = () => z.string().min(1);
	const num = (schema: z.ZodNumber = z.number()) =>
		z.string().trim().min(1).transform(Number).pipe(schema);

	export const schema = z
		.object({
			APP_ENV: z
				.enum(['development', 'production', 'test'])
				.default('development'),
			APP_HOST: str(),
			APP_NAME: str(),
			SERVER_HOST: str(),
			FRONTEND_HOST: str(),
			MISC_CORS_ORIGINS: z.string().default(''),
			INDEXNOW_KEY: z
				.string()
				.regex(/^[a-zA-Z0-9-]{8,128}$/)
				.or(z.literal(''))
				.default(''),
			PORT: num().default(5000),
			DATABASE_URL: str(),
			BETTER_AUTH_SECRET: str(),
			BETTER_AUTH_URL: str(),
			BETTER_AUTH_COOKIE_DOMAIN: z.string().default(''),
			BETTER_AUTH_COOKIE_PREFIX: str(),
			SUPERUSER_EMAIL: str(),
			SUPERUSER_PASSWORD: str(),
			OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
			OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
			OAUTH_GITHUB_CLIENT_ID: z.string().optional(),
			OAUTH_GITHUB_CLIENT_SECRET: z.string().optional(),
			AUTH_PASSWORD_ENABLED: z.enum(['true', 'false']).default('false'),
			LOG_LEVEL: str().default('info'),
			HEALTH_HEAP_MAX_MB: num(z.number().positive()).default(300),
			HEALTH_RSS_MAX_MB: num(z.number().positive()).default(300),
			HEALTH_DISK_THRESHOLD: num(z.number().min(0).max(1)).default(0.8),
			HEALTH_DISK_PATH: str().default('/'),
			BASIC_AUTH_USER: str(),
			BASIC_AUTH_PASS: str(),
			REDIS_HOST: str().default('localhost'),
			REDIS_PORT: num().default(6379),
			REDIS_USER: z.string().optional(),
			REDIS_PASSWORD: z.string().optional(),
			SMTP_HOST: str(),
			SMTP_PORT: z.enum(['465', '587']),
			SMTP_SECURE: z.enum(['true', 'false']),
			SMTP_USER: str(),
			SMTP_PASSWORD: str(),
			SMTP_FROM: str(),
			SMTP_SUPPORT_EMAIL: str(),
			S3_REGION: str().default('us-east-1'),
			S3_ENDPOINT: z.string().optional(),
			S3_BUCKET_NAME: str(),
			S3_ACCESS_KEY_ID: z.string().optional(),
			S3_SECRET_ACCESS_KEY: z.string().optional(),
			// Empty means unset (a compose file passes `${RELEASES_BASE_URL}` as '').
			RELEASES_BASE_URL: z.url().or(z.literal('')).optional(),
			RATE_LIMIT_ENABLED: z.enum(['true', 'false']).default('true'),
			RATE_LIMIT_TTL: num().default(60_000),
			RATE_LIMIT_MAX: num().default(120),
			RATE_LIMIT_AUTH_WINDOW: num().default(10),
			RATE_LIMIT_AUTH_MAX: num().default(100),
			RATE_LIMIT_IP_HEADERS: str().default('x-forwarded-for')
		})
		.refine(
			(env) =>
				!(env.APP_ENV === 'production' && env.AUTH_PASSWORD_ENABLED === 'true'),
			{
				message: 'AUTH_PASSWORD_ENABLED must not be true in production',
				path: ['AUTH_PASSWORD_ENABLED']
			}
		);

	export const getVariables = (): Config.Env => ({
		app: {
			name: env.APP_NAME || '',
			twofaAppName: env.TWOFA_APP_NAME || env.APP_NAME || '',
			env: env.APP_ENV || '',
			host: env.SERVER_HOST || '',
			appHost: env.APP_HOST || '',
			frontendHost: env.FRONTEND_HOST || '',
			miscCorsOrigins: env.MISC_CORS_ORIGINS,
			port: Number(env.PORT) || 5000,
			key: env.APP_KEY || '',
			indexNowKey: env.INDEXNOW_KEY || ''
		},
		logger: {
			level: env.LOG_LEVEL || 'info'
		},
		health: {
			heapMaxMb: Number(env.HEALTH_HEAP_MAX_MB) || 300,
			rssMaxMb: Number(env.HEALTH_RSS_MAX_MB) || 300,
			diskThreshold: env.HEALTH_DISK_THRESHOLD
				? Number(env.HEALTH_DISK_THRESHOLD)
				: 0.8,
			diskPath: env.HEALTH_DISK_PATH || '/'
		},
		database: {
			url: env.DATABASE_URL || ''
		},
		redis: {
			host: env.REDIS_HOST || 'localhost',
			port: Number(env.REDIS_PORT) || 6379,
			username: env.REDIS_USER || '',
			password: env.REDIS_PASSWORD || ''
		},
		basicAuth: {
			user: env.BASIC_AUTH_USER || 'user',
			password: env.BASIC_AUTH_PASS || 'password'
		},
		betterAuth: {
			secret: env.BETTER_AUTH_SECRET || '',
			url: env.BETTER_AUTH_URL || env.SERVER_HOST || '',
			cookieDomain: env.BETTER_AUTH_COOKIE_DOMAIN || '',
			cookiePrefix: env.BETTER_AUTH_COOKIE_PREFIX || '',
			passwordEnabled: env.AUTH_PASSWORD_ENABLED === 'true'
		},
		superuser: {
			email: env.SUPERUSER_EMAIL || '',
			username: env.SUPERUSER_USERNAME || '',
			password: env.SUPERUSER_PASSWORD || ''
		},
		smtp: {
			host: env.SMTP_HOST || '',
			port: Number(env.SMTP_PORT) || 465,
			user: env.SMTP_USER || '',
			password: env.SMTP_PASSWORD || '',
			from: env.SMTP_FROM || '',
			secure: env.SMTP_SECURE === 'true',
			supportEmail: env.SMTP_SUPPORT_EMAIL || ''
		},
		s3: {
			accessKeyId: env.S3_ACCESS_KEY_ID || '',
			secretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
			endpoint: env.S3_ENDPOINT || '',
			bucket: env.S3_BUCKET_NAME || '',
			region: env.S3_REGION || 'us-east-1'
		},
		releases: {
			// Defaults to the bucket's own path-style URL (development); the
			// worker builds artifact URLs the same way.
			baseUrl: (
				env.RELEASES_BASE_URL ||
				`${env.S3_ENDPOINT || ''}/${env.S3_BUCKET_NAME || ''}/releases`
			).replace(/\/+$/, '')
		},
		rateLimit: {
			enabled: env.RATE_LIMIT_ENABLED !== 'false',
			ttl: Number(env.RATE_LIMIT_TTL) || 60_000,
			limit: Number(env.RATE_LIMIT_MAX) || 120,
			authWindow: Number(env.RATE_LIMIT_AUTH_WINDOW) || 10,
			authMax: Number(env.RATE_LIMIT_AUTH_MAX) || 100,
			ipHeaders: (env.RATE_LIMIT_IP_HEADERS || 'x-forwarded-for')
				.split(',')
				.map((header) => header.trim().toLowerCase())
				.filter(Boolean)
		},
		oauth: {
			google: {
				clientId: env.OAUTH_GOOGLE_CLIENT_ID || '',
				clientSecret: env.OAUTH_GOOGLE_CLIENT_SECRET || ''
			},
			github: {
				clientId: env.OAUTH_GITHUB_CLIENT_ID || '',
				clientSecret: env.OAUTH_GITHUB_CLIENT_SECRET || ''
			}
		}
	});
}

@Injectable()
export class CustomConfigService {
	constructor(private readonly config: ConfigService<Config.Env, true>) {}

	get app() {
		return this.config.get('app', { infer: true });
	}

	get logger() {
		return this.config.get('logger', { infer: true });
	}

	get health() {
		return this.config.get('health', { infer: true });
	}

	get database() {
		return this.config.get('database', { infer: true });
	}

	get redis() {
		return this.config.get('redis', { infer: true });
	}

	get basicAuth() {
		return this.config.get('basicAuth', { infer: true });
	}

	get betterAuth() {
		return this.config.get('betterAuth', { infer: true });
	}

	get superuser() {
		return this.config.get('superuser', { infer: true });
	}

	get smtp() {
		return this.config.get('smtp', { infer: true });
	}

	get s3() {
		return this.config.get('s3', { infer: true });
	}

	get releases() {
		return this.config.get('releases', { infer: true });
	}

	get rateLimit() {
		return this.config.get('rateLimit', { infer: true });
	}

	get oauth() {
		return this.config.get('oauth', { infer: true });
	}
}

export default Config;
