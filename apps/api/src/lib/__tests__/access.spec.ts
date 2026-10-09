import { hasPermission } from 'lib/access';

describe('hasPermission', () => {
	it('grants a permission the role holds', () => {
		expect(hasPermission('user', { session: ['list'] })).toBe(true);
		expect(hasPermission('user', { session: ['list', 'revoke'] })).toBe(true);
		expect(hasPermission('admin', { user: ['ban'] })).toBe(true);
		expect(hasPermission('superuser', { user: ['delete'] })).toBe(true);
	});

	it('denies a permission the role lacks', () => {
		expect(hasPermission('user', { user: ['list'] })).toBe(false);
		expect(hasPermission('user', { user: ['delete'] })).toBe(false);
		expect(hasPermission('admin', { user: ['delete'] })).toBe(false);
	});

	it("treats a missing role as the admin plugin's defaultRole", () => {
		expect(hasPermission(null, { session: ['list'] })).toBe(true);
		expect(hasPermission(undefined, { session: ['list'] })).toBe(true);
		expect(hasPermission('', { session: ['list'] })).toBe(true);
		// ...but the default role is still only a `user`.
		expect(hasPermission(null, { user: ['delete'] })).toBe(false);
	});

	it('fails closed on an unrecognized role', () => {
		expect(hasPermission('bogus', { session: ['list'] })).toBe(false);
	});

	it('unions comma-separated roles, ignoring unknown ones', () => {
		expect(hasPermission('bogus,user', { session: ['list'] })).toBe(true);
		expect(hasPermission('user, admin', { user: ['ban'] })).toBe(true);
	});
});
