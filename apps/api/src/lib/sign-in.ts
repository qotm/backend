/**
 * How qotm signs people in (QOT-35, BUILD-PLAN §9): magic links and OAuth
 * (GitHub and Google). No passwords, except in the test environment, where
 * the e2e suite signs seeded users in with them (AUTH_PASSWORD_ENABLED).
 * Shared by the runtime instance (`app.module.ts`) and the tooling instance
 * (`lib/auth.ts`).
 */

/** A magic link works once and expires after 10 minutes. */
export const MAGIC_LINK_TTL_SECONDS = 10 * 60;

/** The plugin's own limiter, matching the per-IP rule in lib/rate-limit.ts. */
export const MAGIC_LINK_RATE_LIMIT = { window: 3600, max: 10 };

interface OAuthKeys {
	clientId: string;
	clientSecret: string;
}

/**
 * The "Continue with GitHub" and "Continue with Google" providers. A provider
 * without keys is left out, so an unconfigured one is "not found" rather than
 * a server error.
 */
export function socialProviders(
	baseUrl: string,
	keys: { github: OAuthKeys; google: OAuthKeys }
) {
	const configured = (k: OAuthKeys) => Boolean(k.clientId && k.clientSecret);
	return {
		...(configured(keys.github) && {
			github: {
				clientId: keys.github.clientId,
				clientSecret: keys.github.clientSecret,
				scope: ['read:user', 'user:email'],
				redirectURI: `${baseUrl}/auth/callback/github`
			}
		}),
		...(configured(keys.google) && {
			google: {
				clientId: keys.google.clientId,
				clientSecret: keys.google.clientSecret,
				scope: ['email', 'profile'],
				redirectURI: `${baseUrl}/auth/callback/google`,
				prompt: 'select_account' as const
			}
		})
	};
}

/** The only client the device flow serves: the qotm CLI (BUILD-PLAN §5). */
export const CLI_CLIENT_ID = 'qotm-cli';

/** Letters and digits nobody misreads: no I, O, 0 or 1. */
const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A code like `QTM-7F3K`, as the sign-in screen shows it. */
export function generateUserCode(random: (max: number) => number) {
	let code = '';
	for (let i = 0; i < 4; i++)
		code += USER_CODE_ALPHABET[random(USER_CODE_ALPHABET.length)];
	return `QTM-${code}`;
}

/**
 * `qotm login` (RFC 8628, the CLI contract): codes live 15 minutes, the CLI
 * polls every 5 seconds, and the member approves at `<frontend>/device`.
 */
export function deviceAuthorizationOptions(
	frontendHost: string,
	random: (max: number) => number
) {
	return {
		expiresIn: '15m' as const,
		interval: '5s' as const,
		generateUserCode: () => generateUserCode(random),
		validateClient: (clientId: string) => clientId === CLI_CLIENT_ID,
		verificationUri: `${frontendHost.replace(/\/$/, '')}/device`
	};
}
