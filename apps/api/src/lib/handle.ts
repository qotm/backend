import { randomBytes } from 'crypto';
import type { PrismaClient } from '@qotm/db/client';

/** Lowercase letters, digits and `_`; 3–30 characters. Matches `user.handle`. */
export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

const FALLBACK = 'member';
// Leaves room for a `_xxxx` suffix inside the 30-character column.
const BASE_MAX = 24;
const ATTEMPTS = 8;

/** A handle-shaped base from an email's local part: `Ada.Mensah+qotm@…` → `ada_mensah_qotm`. */
export function handleBase(email: string) {
	const base = email
		.split('@')[0]
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, BASE_MAX)
		.replace(/_+$/, '');
	return base.length >= 3 ? base : FALLBACK;
}

type HandleDb = Pick<PrismaClient, 'user' | 'handleHistory'>;

/** Whether nobody holds `handle` now or held it before (old handles stay reserved). */
export async function isHandleFree(db: HandleDb, handle: string) {
	const [user, previous] = await Promise.all([
		db.user.findUnique({ where: { handle }, select: { id: true } }),
		db.handleHistory.findUnique({
			where: { oldHandle: handle },
			select: { id: true }
		})
	]);
	return !user && !previous;
}

/**
 * The handle a new account starts with: the email's base if it is free,
 * else the base plus a short random suffix. The member can change it later.
 */
export async function assignHandle(db: HandleDb, email: string) {
	const base = handleBase(email);
	if (await isHandleFree(db, base)) return base;

	for (let i = 0; i < ATTEMPTS; i++) {
		const candidate = `${base}_${randomBytes(2).toString('hex')}`;
		if (await isHandleFree(db, candidate)) return candidate;
	}
	throw new Error(`No free handle found for ${base}`);
}

/**
 * The better-auth pieces that give every new user a handle. Both auth
 * instances (`app.module.ts` and `lib/auth.ts`) spread these in, so accounts
 * made by sign-up and by the seeder get one alike.
 */
export function handleAuthOptions(db: HandleDb) {
	return {
		fields: {
			// `input: false`: a sign-up payload cannot choose its own handle.
			handle: { type: 'string', required: false, input: false }
		} as const,
		databaseHooks: {
			user: {
				create: {
					before: async (user: { email: string }) => ({
						data: { ...user, handle: await assignHandle(db, user.email) }
					})
				}
			}
		}
	};
}
