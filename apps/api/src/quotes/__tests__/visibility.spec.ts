import { QuoteStatus as S } from '@qotm/db/enums';
import { NOT_PUBLIC, canView, isPublic } from 'quotes/visibility';

describe('quote visibility', () => {
	const own = (status: S) => ({ status, contributorId: 'u1' });

	it('shows every public status to anyone', () => {
		for (const status of Object.values(S).filter(
			(s) => !NOT_PUBLIC.includes(s)
		)) {
			expect(isPublic(status)).toBe(true);
			expect(canView(own(status))).toBe(true);
		}
	});

	it('keeps a disputed quote up while it is reviewed', () => {
		expect(isPublic(S.DISPUTED)).toBe(true);
	});

	it.each([S.PRIVATE, S.SUBMITTED, S.ORIGINALITY_CHECK, S.REJECTED])(
		'shows %s to its contributor only',
		(status) => {
			expect(canView(own(status))).toBe(false);
			expect(canView(own(status), 'u2')).toBe(false);
			expect(canView(own(status), 'u1')).toBe(true);
		}
	);

	it('shows a withdrawn quote to nobody, its contributor included', () => {
		expect(canView(own(S.WITHDRAWN), 'u1')).toBe(false);
	});

	it('never matches a quote whose contributor is gone to an anonymous viewer', () => {
		expect(canView({ status: S.PRIVATE, contributorId: null })).toBe(false);
	});
});
