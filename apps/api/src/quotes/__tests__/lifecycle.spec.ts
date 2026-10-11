import { ConflictException } from '@nestjs/common';
import { QuoteStatus as S, QuoteType as T } from '@qotm/db/enums';
import {
	TRACK_STEPS,
	assertTransition,
	canTransition,
	initialStatus,
	nextStatuses
} from 'quotes/lifecycle';

describe('quote lifecycle', () => {
	describe('initialStatus', () => {
		it('starts private quotes private and the rest submitted', () => {
			expect(initialStatus(T.PRIVATE)).toBe(S.PRIVATE);
			expect(initialStatus(T.CANONICAL)).toBe(S.SUBMITTED);
			expect(initialStatus(T.ORIGINAL)).toBe(S.SUBMITTED);
		});
	});

	describe.each([T.CANONICAL, T.ORIGINAL] as const)('%s track', (type) => {
		it('walks every step in order', () => {
			const steps = TRACK_STEPS[type];
			for (let i = 0; i + 1 < steps.length; i++) {
				expect(canTransition(type, steps[i], steps[i + 1])).toBe(true);
			}
		});

		it('never skips a step forward', () => {
			const steps = TRACK_STEPS[type];
			for (let i = 0; i + 2 < steps.length; i++) {
				expect(canTransition(type, steps[i], steps[i + 2])).toBe(false);
			}
		});

		it('ends in the release', () => {
			expect(TRACK_STEPS[type][TRACK_STEPS[type].length - 1]).toBe(
				S.DATASET_RELEASE
			);
			expect(nextStatuses(type, S.DATASET_RELEASE)).toEqual([
				S.DISPUTED,
				S.WITHDRAWN
			]);
		});

		it('publishes a private quote only into SUBMITTED', () => {
			expect(nextStatuses(type, S.PRIVATE)).toEqual([S.SUBMITTED]);
		});

		it('lets any unfinished submitted quote be disputed or withdrawn', () => {
			for (const status of TRACK_STEPS[type]) {
				expect(canTransition(type, status, S.DISPUTED)).toBe(true);
				expect(canTransition(type, status, S.WITHDRAWN)).toBe(true);
			}
		});

		it('returns a disputed quote to where it was, or withdraws it', () => {
			expect(nextStatuses(type, S.DISPUTED, S.CURATED)).toEqual([
				S.CURATED,
				S.WITHDRAWN
			]);
			expect(canTransition(type, S.DISPUTED, S.SUBMITTED, S.CURATED)).toBe(
				false
			);
			// Without its earlier status it can only be withdrawn.
			expect(nextStatuses(type, S.DISPUTED)).toEqual([S.WITHDRAWN]);
		});

		it('treats REJECTED and WITHDRAWN as final', () => {
			expect(nextStatuses(type, S.REJECTED)).toEqual([]);
			expect(nextStatuses(type, S.WITHDRAWN)).toEqual([]);
			expect(nextStatuses(type, S.DISPUTED, S.WITHDRAWN)).toEqual([
				S.WITHDRAWN
			]);
		});
	});

	describe('canonical track', () => {
		const t = T.CANONICAL;

		it('ends a review verified, needing evidence or rejected', () => {
			expect(nextStatuses(t, S.UNDER_REVIEW)).toEqual([
				S.VERIFIED,
				S.NEEDS_EVIDENCE,
				S.REJECTED,
				S.DISPUTED,
				S.WITHDRAWN
			]);
		});

		it('sends a quote with new evidence back to review', () => {
			expect(canTransition(t, S.NEEDS_EVIDENCE, S.UNDER_REVIEW)).toBe(true);
			expect(canTransition(t, S.NEEDS_EVIDENCE, S.VERIFIED)).toBe(false);
		});

		it('keeps verification and curation separate', () => {
			expect(canTransition(t, S.UNDER_REVIEW, S.CURATED)).toBe(false);
			expect(canTransition(t, S.VERIFIED, S.CURATED)).toBe(false);
			// Declined at curation, it stays verified.
			expect(canTransition(t, S.CURATION_REVIEW, S.VERIFIED)).toBe(true);
		});

		it('rejects statuses from the original track', () => {
			expect(nextStatuses(t, S.ORIGINALITY_CHECK)).toEqual([]);
			expect(canTransition(t, S.SUBMITTED, S.ORIGINALITY_CHECK)).toBe(false);
		});
	});

	describe('original track', () => {
		const t = T.ORIGINAL;

		it('publishes, disputes or withdraws after the originality check, never rejects', () => {
			expect(canTransition(t, S.ORIGINALITY_CHECK, S.PUBLISHED)).toBe(true);
			expect(canTransition(t, S.ORIGINALITY_CHECK, S.DISPUTED)).toBe(true);
			expect(canTransition(t, S.ORIGINALITY_CHECK, S.WITHDRAWN)).toBe(true);
			expect(canTransition(t, S.ORIGINALITY_CHECK, S.REJECTED)).toBe(false);
		});

		it('returns a declined candidate to the community', () => {
			expect(canTransition(t, S.CURATION_REVIEW, S.COMMUNITY_DISCOVERY)).toBe(
				true
			);
			expect(canTransition(t, S.CURATION_REVIEW, S.VERIFIED)).toBe(false);
		});

		it('has no verification or evidence step', () => {
			expect(nextStatuses(t, S.UNDER_REVIEW)).toEqual([]);
			expect(nextStatuses(t, S.VERIFIED)).toEqual([]);
			expect(nextStatuses(t, S.NEEDS_EVIDENCE)).toEqual([]);
		});
	});

	describe('private quotes', () => {
		it('have no moves of their own: publishing changes their type', () => {
			expect(nextStatuses(T.PRIVATE, S.PRIVATE)).toEqual([]);
		});
	});

	describe('assertTransition', () => {
		it('passes an allowed move', () => {
			expect(() =>
				assertTransition(T.CANONICAL, S.SUBMITTED, S.UNDER_REVIEW)
			).not.toThrow();
		});

		it('throws a 409 naming the move', () => {
			expect(() =>
				assertTransition(T.CANONICAL, S.SUBMITTED, S.CURATED)
			).toThrow(ConflictException);
			expect(() =>
				assertTransition(T.ORIGINAL, S.PUBLISHED, S.VERIFIED)
			).toThrow('cannot move from PUBLISHED to VERIFIED');
		});
	});
});
