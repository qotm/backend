import { describe, expect, it } from 'vitest';
import { changeNote, diffReleases } from './build.js';

describe('diffReleases', () => {
	it('counts added, corrected and withdrawn by public id', () => {
		const previous = new Map([
			['q_a', 'same'],
			['q_b', 'old wording'],
			['q_c', 'withdrawn since']
		]);
		const next = new Map([
			['q_a', 'same'],
			['q_b', 'new wording'],
			['q_d', 'new']
		]);
		const changes = diffReleases(previous, next);
		expect(changes).toEqual({
			eligible: 3,
			added: 1,
			corrected: 1,
			withdrawn: 1
		});
		expect(changeNote(changes)).toBe('+1 ~1 −1');
	});

	it('treats everything as added for the first release', () => {
		expect(diffReleases(new Map(), new Map([['q_a', 'x']]))).toEqual({
			eligible: 1,
			added: 1,
			corrected: 0,
			withdrawn: 0
		});
	});
});
