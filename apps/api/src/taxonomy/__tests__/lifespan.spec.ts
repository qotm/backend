import { lifespanLine } from 'taxonomy/services';

describe('lifespanLine', () => {
	const line = (
		bornYear: number | null,
		diedYear: number | null,
		description: string | null
	) => lifespanLine({ bornYear, diedYear, description });

	it('writes the AuthorHeader line', () => {
		expect(line(1930, 2002, 'computer scientist')).toBe(
			'1930–2002 · computer scientist'
		);
		expect(line(1942, null, null)).toBe('1942–');
		expect(line(null, 1997, null)).toBe('–1997');
		expect(line(null, null, 'programmer')).toBe('programmer');
		expect(line(null, null, null)).toBe('—');
	});
});
