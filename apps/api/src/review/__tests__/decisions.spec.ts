import { ReviewKind as K, ReviewOutcome as O } from '@qotm/db/enums';
import {
	CURATION_CHECKLIST,
	OUTCOMES,
	isChecklist,
	isOutcomeOf,
	parseReportRef,
	reportRef
} from 'review';

describe('review decisions', () => {
	it('offers each kind its own outcomes', () => {
		expect(OUTCOMES[K.VERIFICATION]).toEqual([
			O.VERIFY,
			O.NEEDS_EVIDENCE,
			O.REJECT
		]);
		expect(OUTCOMES[K.CURATION]).toEqual([O.CURATE, O.KEEP_OUT]);
		expect(OUTCOMES[K.MODERATION]).toEqual([
			O.PUBLISH,
			O.MARK_DISPUTED,
			O.WITHDRAW
		]);
	});

	it('gives every outcome to exactly one kind', () => {
		for (const outcome of Object.values(O)) {
			const kinds = Object.values(K).filter((k) => isOutcomeOf(k, outcome));
			expect(kinds).toHaveLength(1);
		}
	});

	it('rejects an outcome from another kind', () => {
		expect(isOutcomeOf(K.CURATION, O.VERIFY)).toBe(false);
		expect(isOutcomeOf(K.VERIFICATION, O.WITHDRAW)).toBe(false);
	});
});

describe('curation checklist', () => {
	const all = (value: boolean) =>
		Object.fromEntries(
			Object.keys(CURATION_CHECKLIST).map((key) => [key, value])
		);

	it('has the design’s seven items', () => {
		expect(Object.keys(CURATION_CHECKLIST)).toHaveLength(7);
	});

	it('accepts every item answered with a boolean', () => {
		expect(isChecklist(all(true))).toBe(true);
		expect(isChecklist({ ...all(true), lasting: false })).toBe(true);
	});

	it('rejects missing, extra or non-boolean items', () => {
		const missing = all(true);
		delete missing.lasting;
		expect(isChecklist(missing)).toBe(false);
		expect(isChecklist({ ...all(true), extra: true })).toBe(false);
		expect(isChecklist({ ...all(true), lasting: 'yes' })).toBe(false);
		expect(isChecklist(null)).toBe(false);
		expect(isChecklist([true])).toBe(false);
	});
});

describe('report references', () => {
	it('pads the number to four digits', () => {
		expect(reportRef(412)).toBe('r_0412');
		expect(reportRef(12345)).toBe('r_12345');
	});

	it('reads a reference back', () => {
		expect(parseReportRef('r_0412')).toBe(412);
		expect(parseReportRef(reportRef(12345))).toBe(12345);
		expect(parseReportRef('q_0412')).toBeNull();
		expect(parseReportRef('r_12')).toBeNull();
	});
});
