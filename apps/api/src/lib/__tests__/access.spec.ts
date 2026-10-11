import {
	DEFAULT_ROLE,
	hasPermission,
	hasRole,
	roles,
	rolesOf,
	type Permission
} from 'lib/access';

/** Every permission in the matrix, each as its own check. */
const PERMISSIONS: Record<string, Permission> = {
	'session.list': { session: ['list'] },
	'session.revoke': { session: ['revoke'] },
	'quote.verify': { quote: ['verify'] },
	'quote.correct': { quote: ['correct'] },
	'quote.withdraw': { quote: ['withdraw'] },
	'report.moderate': { report: ['moderate'] },
	'quote.curate': { quote: ['curate'] },
	'taxonomy.manage': { taxonomy: ['manage'] },
	'release.preview': { release: ['preview'] },
	'release.publish': { release: ['publish'] },
	'audit.read': { audit: ['read'] },
	'dashboard.counts': { dashboard: ['counts'] },
	'dashboard.read': { dashboard: ['read'] },
	'user.list': { user: ['list'] },
	'user.set-role': { user: ['set-role'] },
	'user.ban': { user: ['ban'] },
	'user.impersonate': { user: ['impersonate'] },
	'user.delete': { user: ['delete'] },
	'session.delete': { session: ['delete'] }
};

const OWN_SESSIONS = ['session.list', 'session.revoke'];
const VERIFY = ['quote.verify', 'quote.correct'];
const MODERATE = ['quote.withdraw', 'report.moderate'];
const ADMIN = [
	...OWN_SESSIONS,
	...VERIFY,
	...MODERATE,
	'quote.curate',
	'taxonomy.manage',
	'release.preview',
	'release.publish',
	'audit.read',
	'dashboard.counts',
	'dashboard.read',
	'user.list',
	'user.set-role',
	'user.ban'
];

/** The matrix in the module doc of lib/access.ts. */
const GRANTED: Record<string, string[]> = {
	member: OWN_SESSIONS,
	verifier: [...OWN_SESSIONS, ...VERIFY, 'dashboard.counts'],
	moderator: [...OWN_SESSIONS, ...MODERATE, 'dashboard.counts'],
	admin: ADMIN,
	superuser: Object.keys(PERMISSIONS)
};

describe('roles', () => {
	it('are the design’s four plus the bootstrap superuser', () => {
		expect(Object.keys(roles)).toEqual([
			'member',
			'verifier',
			'moderator',
			'admin',
			'superuser'
		]);
	});

	it('start every account as a member', () => {
		expect(DEFAULT_ROLE).toBe('member');
		expect(rolesOf(null)).toEqual(['member']);
	});
});

describe.each(Object.keys(GRANTED))('hasPermission for %s', (role) => {
	it.each(Object.keys(PERMISSIONS))('%s', (name) => {
		expect(hasPermission(role, PERMISSIONS[name])).toBe(
			GRANTED[role].includes(name)
		);
	});
});

describe('hasPermission', () => {
	it('needs every action asked for, not just one', () => {
		expect(hasPermission('verifier', { quote: ['verify', 'curate'] })).toBe(
			false
		);
		expect(hasPermission('admin', { quote: ['verify', 'curate'] })).toBe(true);
	});

	it('treats a missing role as the default role, a member', () => {
		expect(hasPermission(null, { session: ['list'] })).toBe(true);
		expect(hasPermission(undefined, { quote: ['verify'] })).toBe(false);
		expect(hasPermission('', { session: ['list'] })).toBe(true);
	});

	it('fails closed on an unrecognized role, including the old `user`', () => {
		expect(hasPermission('bogus', { session: ['list'] })).toBe(false);
		expect(hasPermission('user', { session: ['list'] })).toBe(false);
	});

	it('unions comma-separated roles, ignoring unknown ones', () => {
		expect(hasPermission('verifier,moderator', { quote: ['verify'] })).toBe(
			true
		);
		expect(hasPermission('verifier, moderator', { report: ['moderate'] })).toBe(
			true
		);
		expect(hasPermission('bogus,member', { session: ['list'] })).toBe(true);
	});
});

describe('hasRole', () => {
	it('finds a role in a multi-role string or array', () => {
		expect(hasRole('admin,superuser', 'superuser')).toBe(true);
		expect(hasRole(['verifier', 'moderator'], 'moderator')).toBe(true);
		expect(hasRole('moderator', 'admin')).toBe(false);
	});
});
