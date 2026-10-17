import { describe, expect, it, vi } from 'vitest';
import { checkOriginality, normalize, recheckOriginals } from './check.js';

type Row = { id: string; text: string; score: number };

/** A database double: `corpus` is what the trigram query returns. */
function fakeDb(
	quote: { type: string; status: string } | null,
	corpus: Row[] = []
) {
	const tx = {
		$executeRaw: vi.fn(() => Promise.resolve(0)),
		$queryRaw: vi.fn(() => Promise.resolve(corpus)),
		quote: {
			findUnique: vi.fn(() =>
				Promise.resolve(
					quote
						? {
								id: 'q1',
								publicId: 'q_5k0q2j',
								text: 'Make it work, make it right, make it fast.',
								...quote
							}
						: null
				)
			),
			updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
			findMany: vi.fn(() =>
				Promise.resolve([{ id: 'q1', text: 'A green build is a hypothesis.' }])
			)
		},
		quoteEvent: { create: vi.fn(() => Promise.resolve({})) },
		matchResult: { upsert: vi.fn(() => Promise.resolve({})) }
	};
	const db = {
		$transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
		quote: tx.quote
	};
	return { db: db as never, tx };
}

describe('checkOriginality', () => {
	it('publishes an original with no possible match, once, with its event', async () => {
		const { db, tx } = fakeDb({
			type: 'ORIGINAL',
			status: 'ORIGINALITY_CHECK'
		});
		await expect(checkOriginality(db, 'q1')).resolves.toEqual({
			outcome: 'published',
			publicId: 'q_5k0q2j'
		});
		expect(tx.quote.updateMany).toHaveBeenCalledWith({
			where: { id: 'q1', status: 'ORIGINALITY_CHECK' },
			data: { status: 'PUBLISHED', publishedAt: expect.any(Date) }
		});
		expect(tx.quoteEvent.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				fromStatus: 'ORIGINALITY_CHECK',
				toStatus: 'PUBLISHED',
				actorId: null
			})
		});
		expect(tx.matchResult.upsert).not.toHaveBeenCalled();
	});

	it('holds a possible match for a moderator and records it', async () => {
		const { db, tx } = fakeDb(
			{ type: 'ORIGINAL', status: 'ORIGINALITY_CHECK' },
			[
				{
					id: 'beck',
					text: 'Make it work, make it right, make it fast!',
					score: 1
				},
				{ id: 'other', text: 'Make it work first.', score: 0.6234 }
			]
		);
		const result = await checkOriginality(db, 'q1');
		expect(result).toEqual({
			outcome: 'held',
			matches: [
				{ matchedQuoteId: 'beck', method: 'EXACT', score: 1 },
				{ matchedQuoteId: 'other', method: 'FUZZY', score: 0.62 }
			]
		});
		expect(tx.matchResult.upsert).toHaveBeenCalledTimes(2);
		expect(tx.quote.updateMany).not.toHaveBeenCalled();
	});

	it.each([
		['already published', { type: 'ORIGINAL', status: 'PUBLISHED' }],
		['not an original', { type: 'CANONICAL', status: 'ORIGINALITY_CHECK' }],
		['gone', null]
	])('skips a quote that is %s, so a retry is harmless', async (_, quote) => {
		const { db, tx } = fakeDb(quote);
		await expect(checkOriginality(db, 'q1')).resolves.toMatchObject({
			outcome: 'skipped'
		});
		expect(tx.quote.updateMany).not.toHaveBeenCalled();
	});

	it('skips when a moderator moved the quote while it was being checked', async () => {
		const { db, tx } = fakeDb({
			type: 'ORIGINAL',
			status: 'ORIGINALITY_CHECK'
		});
		tx.quote.updateMany.mockResolvedValueOnce({ count: 0 });
		await expect(checkOriginality(db, 'q1')).resolves.toMatchObject({
			outcome: 'skipped'
		});
		expect(tx.quoteEvent.create).not.toHaveBeenCalled();
	});

	it('throws when the database fails, so the producer’s retries apply', async () => {
		const { db, tx } = fakeDb({
			type: 'ORIGINAL',
			status: 'ORIGINALITY_CHECK'
		});
		tx.$queryRaw.mockRejectedValueOnce(new Error('connection lost'));
		await expect(checkOriginality(db, 'q1')).rejects.toThrow('connection lost');
		expect(tx.quote.updateMany).not.toHaveBeenCalled();
	});
});

describe('recheckOriginals', () => {
	it('records new possible matches and never unpublishes', async () => {
		const { db, tx } = fakeDb(null, [
			{ id: 'm', text: 'A green build is a hypothesis.', score: 1 }
		]);
		await expect(recheckOriginals(db)).resolves.toEqual({
			checked: 1,
			flagged: 1
		});
		expect(tx.matchResult.upsert).toHaveBeenCalledTimes(1);
		expect(tx.quote.updateMany).not.toHaveBeenCalled();
	});
});

describe('normalize', () => {
	it('matches the API’s: case, punctuation and accents ignored', () => {
		expect(normalize('Ça marche — 97%!')).toBe('ca marche 97');
	});
});
