import { inflateSync } from 'node:zlib';
import {
	pageKey,
	pageRevision,
	shareCardOf,
	shareKey,
	shareRevision,
	solidPng,
	type PageCard
} from 'share';

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

	it('keeps the quote card key when only the terminal template changes', () => {
		// Pinned: a template bump moves only its own variant's keys.
		expect(shareRevision(shareCardOf(quote), 'quote')).toBe('c9b6c6f809c7');
		expect(shareRevision(shareCardOf(quote), 'terminal')).toBe('14ba44da9190');
	});
});

describe('page cards', () => {
	const author: PageCard = {
		kind: 'author',
		path: '/authors/dijkstra',
		eyebrow: 'Author',
		title: 'Edsger W. Dijkstra',
		line: '1930–2002 · computer scientist',
		quote: {
			text: 'Simplicity is prerequisite for reliability.',
			author: 'Edsger W. Dijkstra'
		}
	};

	it('keys an author, a topic and the site card by kind, slug and revision', () => {
		const rev = pageRevision(author);
		expect(rev).toMatch(/^[0-9a-f]{12}$/);
		expect(pageKey(author, rev)).toBe(`og/authors/dijkstra-${rev}.png`);
		expect(
			pageKey(
				{ ...author, kind: 'topic', path: '/topics/software-design' },
				rev
			)
		).toBe(`og/topics/software-design-${rev}.png`);
		expect(pageKey({ ...author, kind: 'site', path: '/' }, rev)).toBe(
			`og/site-${rev}.png`
		);
	});

	it('is a new revision when its featured quote or line changes', () => {
		const rev = pageRevision(author);
		expect(pageRevision({ ...author })).toBe(rev);
		expect(pageRevision({ ...author, quote: null })).not.toBe(rev);
		expect(pageRevision({ ...author, line: '1930–2002' })).not.toBe(rev);
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
