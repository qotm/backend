import { nextVersion } from 'releases';

describe('nextVersion', () => {
	const sept = new Date(Date.UTC(2026, 8, 26));

	it('starts each month at 1', () => {
		expect(nextVersion([], sept)).toBe('v2026.09.1');
		expect(nextVersion(['v2026.08.3'], sept)).toBe('v2026.09.1');
	});

	it('counts up within the month, past gaps', () => {
		expect(nextVersion(['v2026.09.1', 'v2026.09.3', 'v2026.08.9'], sept)).toBe(
			'v2026.09.4'
		);
		expect(nextVersion(['v2026.09.9'], sept)).toBe('v2026.09.10');
	});
});
