/** `window` is in seconds; `max` is requests allowed per window. */
export interface AuthRateLimitRule {
	window: number;
	max: number;
}

/**
 * Stricter windows for the better-auth endpoints that actually get attacked.
 * Paths are matched after normalization against `basePath` (`/auth`), so they
 * are written without it.
 *
 * Shared by the runtime instance (`app.module.ts`) and the standalone tooling
 * instance (`lib/auth.ts`) so the two cannot drift.
 */
export const AUTH_RATE_LIMIT_RULES: Record<string, AuthRateLimitRule> = {
	'/sign-in/email': { window: 60, max: 5 },
	'/sign-up/email': { window: 3600, max: 5 },
	'/forget-password': { window: 3600, max: 3 },
	'/reset-password': { window: 3600, max: 5 }
};
