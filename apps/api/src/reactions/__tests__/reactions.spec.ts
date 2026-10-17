import { BadRequestException } from '@nestjs/common';
import { setReaction } from 'reactions';

/** A db double whose transaction client counts what each call would change. */
function fakeDb({ changed = 1, type = 'ORIGINAL' as string | null } = {}) {
	const tx = {
		like: {
			createMany: vi.fn(async () => ({ count: changed })),
			deleteMany: vi.fn(async () => ({ count: changed }))
		},
		favorite: {
			createMany: vi.fn(async () => ({ count: changed })),
			deleteMany: vi.fn(async () => ({ count: changed }))
		},
		recommendation: {
			createMany: vi.fn(async () => ({ count: changed })),
			deleteMany: vi.fn(async () => ({ count: changed }))
		},
		$queryRaw: vi.fn(async () => (type ? [{ type }] : [])),
		quote: {
			update: vi.fn(async ({ data }) => ({ [Object.keys(data)[0]]: 7 })),
			// promoteOriginal's read: nothing to promote here (the e2e suite covers it).
			findUnique: vi.fn(async () => null)
		}
	};
	const db = { $transaction: vi.fn((fn) => fn(tx)) };
	return { db: db as never, tx };
}

const key = { userId: 'u1', quoteId: 'q1' };

describe('setReaction', () => {
	it('inserts without duplicating and adds what it inserted', async () => {
		const { db, tx } = fakeDb();
		await expect(setReaction(db, 'like', key, true)).resolves.toEqual({
			active: true,
			count: 7
		});
		expect(tx.like.createMany).toHaveBeenCalledWith({
			data: [key],
			skipDuplicates: true
		});
		expect(tx.quote.update).toHaveBeenCalledWith({
			where: { id: 'q1' },
			data: { likeCount: { increment: 1 } },
			select: { likeCount: true, favoriteCount: true, recommendCount: true }
		});
	});

	it('subtracts only what it deleted', async () => {
		const { db, tx } = fakeDb();
		await setReaction(db, 'favorite', key, false);
		expect(tx.favorite.deleteMany).toHaveBeenCalledWith({ where: key });
		expect(tx.quote.update.mock.calls[0][0].data).toEqual({
			favoriteCount: { increment: -1 }
		});
	});

	it('runs at read committed, not the service default of serializable', async () => {
		const { db } = fakeDb();
		await setReaction(db, 'like', key, true);
		expect(
			(db as { $transaction: ReturnType<typeof vi.fn> }).$transaction
		).toHaveBeenCalledWith(expect.any(Function), {
			isolationLevel: 'ReadCommitted'
		});
	});

	it('leaves the count alone when nothing changed', async () => {
		const { db, tx } = fakeDb({ changed: 0 });
		await setReaction(db, 'like', key, true);
		expect(tx.quote.update.mock.calls[0][0].data).toEqual({
			likeCount: { increment: 0 }
		});
	});

	it('404s when the quote does not exist', async () => {
		const { db } = fakeDb({ type: null });
		await expect(setReaction(db, 'like', key, true)).rejects.toThrow(
			'Quote not found'
		);
	});

	it('recommends community originals only', async () => {
		const { db, tx } = fakeDb({ type: 'CANONICAL' });
		await expect(setReaction(db, 'recommend', key, true)).rejects.toThrow(
			BadRequestException
		);
		expect(tx.recommendation.createMany).not.toHaveBeenCalled();

		const original = fakeDb({ type: 'ORIGINAL' });
		await setReaction(original.db, 'recommend', key, true);
		expect(original.tx.quote.update.mock.calls[0][0].data).toEqual({
			recommendCount: { increment: 1 }
		});
	});
});
