import { adminQuoteWhere } from 'admin/quotes/where';

describe('adminQuoteWhere', () => {
	it('never lists private quotes', () => {
		expect(adminQuoteWhere({ q: undefined })).toEqual({
			type: { not: 'PRIVATE' }
		});
	});

	it('narrows by type and state', () => {
		expect(
			adminQuoteWhere({
				q: undefined,
				type: 'original',
				state: 'PUBLISHED'
			})
		).toEqual({
			type: 'ORIGINAL',
			status: 'PUBLISHED'
		});
	});

	it('searches text, attribution and author, and an id exactly', () => {
		const text = { contains: 'q_8f2k1c', mode: 'insensitive' };
		expect(adminQuoteWhere({ q: 'q_8f2k1c' }).OR).toEqual([
			{ text },
			{ attribution: text },
			{ author: { name: text } },
			{ publicId: 'q_8f2k1c' }
		]);
		expect(adminQuoteWhere({ q: 'knuth' }).OR).toHaveLength(3);
	});
});
