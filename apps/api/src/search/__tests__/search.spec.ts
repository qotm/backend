import { containsPattern } from 'search/services';

describe('containsPattern', () => {
	it('wraps the text for ILIKE, escaping its wildcards', () => {
		expect(containsPattern('knuth')).toBe('%knuth%');
		expect(containsPattern('100%_a\\b')).toBe('%100\\%\\_a\\\\b%');
	});
});
