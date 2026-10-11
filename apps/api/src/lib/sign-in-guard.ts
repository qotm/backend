import { createHash } from 'crypto';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import disposableDomains from 'disposable-email-domains';
import disposableWildcards from 'disposable-email-domains/wildcard.json';

/**
 * The open sign-up rule (QOT-7, BUILD-PLAN §9): anyone may join with a magic
 * link, but not with a throwaway address, and not by flooding one inbox.
 * The per-IP limit (10 an hour) is a better-auth rate-limit rule in
 * `lib/rate-limit.ts`; this guard adds what better-auth cannot key on.
 */

export const MAGIC_LINK_PATH = '/sign-in/magic-link';

/** At most this many links per email address per window. */
export const EMAIL_LIMIT = { max: 3, windowSeconds: 10 * 60 };

const DISPOSABLE = new Set<string>(disposableDomains);
const DISPOSABLE_PARENTS: string[] = disposableWildcards;

/** Whether an address is at a known disposable-email domain (or under one). */
export function isDisposableEmail(email: string) {
	const domain = email.trim().toLowerCase().split('@')[1];
	if (!domain) return false;
	if (DISPOSABLE.has(domain)) return true;
	return DISPOSABLE_PARENTS.some(
		(parent) => domain === parent || domain.endsWith(`.${parent}`)
	);
}

/** The Redis key counting links sent to an address, without storing it. */
export function emailLimitKey(email: string) {
	const digest = createHash('sha256')
		.update(email.trim().toLowerCase())
		.digest('hex')
		.slice(0, 32);
	return `auth:magic-link:${digest}`;
}

/**
 * A better-auth `before` hook for magic-link requests: refuses disposable
 * addresses (400) and, when `countSends` is given, more than
 * EMAIL_LIMIT.max links per address per window (429).
 */
export function signInGuard(countSends?: (email: string) => Promise<number>) {
	return createAuthMiddleware(async (ctx) => {
		if (ctx.path !== MAGIC_LINK_PATH) return;
		const email = String((ctx.body as { email?: unknown })?.email ?? '');
		if (isDisposableEmail(email)) {
			throw new APIError('BAD_REQUEST', {
				code: 'DISPOSABLE_EMAIL',
				message: 'Use a permanent email address to sign in'
			});
		}
		if (countSends && (await countSends(email)) > EMAIL_LIMIT.max) {
			throw new APIError('TOO_MANY_REQUESTS', {
				code: 'TOO_MANY_LINKS',
				message:
					'Too many sign-in links for this address; try again in a few minutes'
			});
		}
	});
}
