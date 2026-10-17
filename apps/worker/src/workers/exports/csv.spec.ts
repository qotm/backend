import { describe, expect, it } from 'vitest';
import { csvField, csvRow } from './csv.js';
import { adminQuoteWhere } from './export.js';

describe('csvField', () => {
	it('quotes commas, quotes and line breaks', () => {
		expect(csvField('plain')).toBe('plain');
		expect(csvField('a, b')).toBe('"a, b"');
		expect(csvField('say "hi"')).toBe('"say ""hi"""');
		expect(csvField('two\nlines')).toBe('"two\nlines"');
		expect(csvField(null)).toBe('');
		expect(csvField(1975)).toBe('1975');
	});

	it('defuses spreadsheet formulas', () => {
		expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
		expect(csvField('+1')).toBe("'+1");
		expect(csvField('@handle')).toBe("'@handle");
	});

	it('ends rows with CRLF', () => {
		expect(csvRow(['a', 'b'])).toBe('a,b\r\n');
	});
});

describe('adminQuoteWhere', () => {
	it('matches the API’s filter', () => {
		expect(adminQuoteWhere({})).toEqual({ type: { not: 'PRIVATE' } });
		expect(adminQuoteWhere({ state: 'VERIFIED', ids: ['q_8f2k1c'] })).toEqual({
			type: { not: 'PRIVATE' },
			publicId: { in: ['q_8f2k1c'] }
		});
		expect(adminQuoteWhere({ type: 'canonical', state: 'CURATED' })).toEqual({
			type: 'CANONICAL',
			status: 'CURATED'
		});
		expect(adminQuoteWhere({ q: 'q_8f2k1c' }).OR).toHaveLength(4);
		expect(adminQuoteWhere({ q: 'knuth' }).OR).toHaveLength(3);
	});
});
