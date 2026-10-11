import { lifespanDates, slugify } from 'admin/taxonomy/services';

describe('slugify', () => {
	it('makes a slug from a name', () => {
		expect(slugify('Edsger W. Dijkstra', 80)).toBe('edsger-w-dijkstra');
		expect(slugify('Harold Abelson & Gerald Jay Sussman', 80)).toBe(
			'harold-abelson-gerald-jay-sussman'
		);
		expect(slugify('Kurt Gödel', 80)).toBe('kurt-godel');
		expect(slugify('software design', 8)).toBe('software');
		expect(slugify('ab cd', 3)).toBe('ab');
	});
});

describe('lifespanDates', () => {
	it('writes the dates column', () => {
		expect(lifespanDates({ bornYear: 1930, diedYear: 2002 })).toBe('1930–2002');
		expect(lifespanDates({ bornYear: 1942, diedYear: null })).toBe('1942–');
		expect(lifespanDates({ bornYear: null, diedYear: null })).toBe('—');
	});
});
