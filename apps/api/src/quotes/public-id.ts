import { randomInt } from 'crypto';
import { Prisma } from '@qotm/db/client';

/** `q_` and six lowercase letters or digits: `q_8f2k1c`. Permanent, never reused. */
export const PUBLIC_ID_PATTERN = /^q_[0-9a-z]{6}$/;

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const LENGTH = 6;
const ATTEMPTS = 5;
const INDEX = 'quotes_public_id_idx';

export function generatePublicId() {
	let id = 'q_';
	for (let i = 0; i < LENGTH; i++) id += ALPHABET[randomInt(ALPHABET.length)];
	return id;
}

/**
 * Whether `error` is a unique violation on `quotes.public_id`. With the pg
 * driver adapter, Prisma names the violated index in
 * `meta.driverAdapterError.cause.constraint` rather than in `meta.target`.
 */
export function isPublicIdCollision(error: unknown) {
	if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
	if (error.code !== 'P2002') return false;
	const meta = error.meta as
		| {
				target?: string[] | string;
				driverAdapterError?: { cause?: { constraint?: { index?: string } } };
		  }
		| undefined;
	const index = meta?.driverAdapterError?.cause?.constraint?.index;
	const target = meta?.target;
	return (
		index === INDEX ||
		target === INDEX ||
		(Array.isArray(target) && target.includes('publicId'))
	);
}

/**
 * Runs `create` with a fresh public id, retrying with a new one when it
 * collides with an existing quote's. 36^6 ids make a collision rare; any other
 * error is rethrown at once.
 */
export async function withPublicId<T>(
	create: (publicId: string) => Promise<T>,
	generate: () => string = generatePublicId
): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await create(generate());
		} catch (error) {
			if (!isPublicIdCollision(error) || attempt >= ATTEMPTS) throw error;
		}
	}
}
