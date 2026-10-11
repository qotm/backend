import { Prisma } from '@qotm/db/client';
import {
	PUBLIC_ID_PATTERN,
	generatePublicId,
	isPublicIdCollision,
	withPublicId
} from 'quotes/public-id';

/** A unique violation as Prisma reports it through the pg driver adapter. */
function uniqueViolation(index: string) {
	return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
		code: 'P2002',
		clientVersion: 'test',
		meta: {
			modelName: 'Quote',
			driverAdapterError: {
				cause: { kind: 'UniqueConstraintViolation', constraint: { index } }
			}
		}
	});
}

describe('generatePublicId', () => {
	it('makes q_ plus six lowercase letters or digits', () => {
		for (let i = 0; i < 200; i++) {
			expect(generatePublicId()).toMatch(PUBLIC_ID_PATTERN);
		}
	});

	it('does not repeat itself', () => {
		const ids = new Set(Array.from({ length: 1000 }, generatePublicId));
		expect(ids.size).toBe(1000);
	});
});

describe('isPublicIdCollision', () => {
	it('recognises a violation of the public id index', () => {
		expect(isPublicIdCollision(uniqueViolation('quotes_public_id_idx'))).toBe(
			true
		);
	});

	it('ignores other unique violations and other errors', () => {
		expect(isPublicIdCollision(uniqueViolation('quotes_pk'))).toBe(false);
		expect(isPublicIdCollision(new Error('boom'))).toBe(false);
	});
});

describe('withPublicId', () => {
	it('retries with a new id after a collision', async () => {
		const ids = ['q_aaaaaa', 'q_bbbbbb'];
		const create = vi
			.fn()
			.mockRejectedValueOnce(uniqueViolation('quotes_public_id_idx'))
			.mockImplementation(async (id: string) => id);

		await expect(withPublicId(create, () => ids.shift()!)).resolves.toBe(
			'q_bbbbbb'
		);
		expect(create).toHaveBeenCalledTimes(2);
	});

	it('rethrows any other error at once', async () => {
		const create = vi.fn().mockRejectedValue(uniqueViolation('quotes_pk'));
		await expect(withPublicId(create)).rejects.toThrow();
		expect(create).toHaveBeenCalledTimes(1);
	});

	it('gives up after five collisions', async () => {
		const create = vi
			.fn()
			.mockRejectedValue(uniqueViolation('quotes_public_id_idx'));
		await expect(withPublicId(create)).rejects.toThrow();
		expect(create).toHaveBeenCalledTimes(5);
	});
});
