import { inflateSync } from 'node:zlib';
import { shareCardOf, shareKey, shareRevision, solidPng } from 'share';

const quote = {
	publicId: 'q_8f2k1c',
	text: 'Simplicity is prerequisite for reliability.',
	type: 'CANONICAL',
	attribution: null,
	author: { name: 'Edsger W. Dijkstra' },
	contributor: { handle: 'kofi' }
};

describe('share cards', () => {
	it('credits the author, or the member for an original', () => {
		expect(shareCardOf(quote).author).toBe('Edsger W. Dijkstra');
		expect(
			shareCardOf({ ...quote, author: null, attribution: 'Donald E. Knuth' })
				.author
		).toBe('Donald E. Knuth');
		expect(shareCardOf({ ...quote, type: 'ORIGINAL' }).author).toBe('@kofi');
		expect(
			shareCardOf({ ...quote, type: 'ORIGINAL', contributor: null }).author
		).toBe('a former member');
	});

	it('changes revision with the wording, credit or variant, and only then', () => {
		const card = shareCardOf(quote);
		const rev = shareRevision(card, 'quote');
		expect(rev).toMatch(/^[0-9a-f]{12}$/);
		expect(shareRevision({ ...card }, 'quote')).toBe(rev);
		expect(shareRevision({ ...card, text: 'Simplicity.' }, 'quote')).not.toBe(
			rev
		);
		expect(shareRevision({ ...card, author: 'EWD' }, 'quote')).not.toBe(rev);
		expect(shareRevision(card, 'terminal')).not.toBe(rev);
		expect(shareKey('q_8f2k1c', 'quote', rev)).toBe(
			`share/q_8f2k1c/quote-${rev}.png`
		);
	});
});

describe('solidPng', () => {
	it('writes a valid PNG of the size and colour asked', () => {
		const png = solidPng(3, 2, '#f4f2ed');
		expect(png.subarray(0, 8)).toEqual(
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
		);
		expect(png.readUInt32BE(16)).toBe(3);
		expect(png.readUInt32BE(20)).toBe(2);
		const idatLength = png.readUInt32BE(33);
		const pixels = inflateSync(png.subarray(41, 41 + idatLength));
		expect([...pixels.subarray(0, 4)]).toEqual([0, 0xf4, 0xf2, 0xed]);
	});
});
