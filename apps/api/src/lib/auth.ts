import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, magicLink, openAPI } from 'better-auth/plugins';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@qotm/db/client';
import { DEFAULT_ROLE, ac, roles } from './access';
import { AUTH_RATE_LIMIT_RULES } from './rate-limit';
import { OriginBuilder } from '../common/misc';
import { handleAuthOptions } from './handle';
import {
	MAGIC_LINK_RATE_LIMIT,
	MAGIC_LINK_TTL_SECONDS,
	socialProviders
} from './sign-in';
import { signInGuard } from './sign-in-guard';

const { env } = process;

const db = new PrismaClient({
	adapter: new PrismaPg({
		connectionString: env.DATABASE_URL
	})
});
const handle = handleAuthOptions(db);

export const auth = betterAuth({
	appName: env.APP_NAME,
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	basePath: '/auth',
	database: prismaAdapter(db, {
		provider: 'postgresql'
	}),
	// No passwords in qotm; only the test environment turns them on.
	emailAndPassword: {
		enabled: env.AUTH_PASSWORD_ENABLED === 'true',
		requireEmailVerification: true
	},
	hooks: { before: signInGuard() },
	user: {
		additionalFields: {
			onboardingCompletedAt: { type: 'date', required: false, input: false },
			...handle.fields
		}
	},
	databaseHooks: handle.databaseHooks,
	advanced: {
		// Must match the runtime instance: the realtime gateway validates socket
		// sessions through this one, so a different cookie name would reject them.
		cookiePrefix: env.BETTER_AUTH_COOKIE_PREFIX,
		crossSubDomainCookies: {
			enabled: Boolean(env.BETTER_AUTH_COOKIE_DOMAIN),
			domain: env.BETTER_AUTH_COOKIE_DOMAIN || undefined
		},
		database: {
			joins: true
		}
	},
	socialProviders: socialProviders(env.BETTER_AUTH_URL || '', {
		github: {
			clientId: env.OAUTH_GITHUB_CLIENT_ID || '',
			clientSecret: env.OAUTH_GITHUB_CLIENT_SECRET || ''
		},
		google: {
			clientId: env.OAUTH_GOOGLE_CLIENT_ID || '',
			clientSecret: env.OAUTH_GOOGLE_CLIENT_SECRET || ''
		}
	}),
	// Mirrors the runtime config in `app.module.ts` so the two instances agree on
	// the rules. This instance is tooling-only (CLI, schema generation) and never
	// serves traffic, so it keeps better-auth's default in-memory storage — the
	// Redis-backed `customStorage` lives with the Nest DI container.
	rateLimit: {
		customRules: AUTH_RATE_LIMIT_RULES
	},
	plugins: [
		admin({
			defaultRole: DEFAULT_ROLE,
			ac,
			roles
		}),
		// Tooling never serves sign-in; it only needs the same schema.
		magicLink({
			expiresIn: MAGIC_LINK_TTL_SECONDS,
			rateLimit: MAGIC_LINK_RATE_LIMIT,
			sendMagicLink: () => {
				throw new Error('The tooling auth instance does not send magic links');
			}
		}),
		openAPI()
	],
	trustedOrigins: [
		env.FRONTEND_HOST!,
		...OriginBuilder.build(env.MISC_CORS_ORIGINS)
	]
});

export type BetterAuth = typeof auth;
