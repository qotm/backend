import { createAccessControl } from 'better-auth/plugins/access';

/**
 * Permission statements — the vocabulary every authorization check draws from.
 *
 * Add a resource here and it is immediately available to
 * `@UserHasPermission({ permission: { <resource>: ['<action>'] } })` on HTTP
 * routes, to `@WsPermissions(...)` on websocket handlers, and to
 * {@link hasPermission} for offline checks. Grant it to a role below, or it is
 * held by nobody but `superuser`.
 *
 * The qotm roles (BUILD-PLAN §5; roles are admin-assigned only, no automatic
 * promotion). Ownership — a member editing their own quote or settings — is
 * checked in the service, never granted here.
 *
 * | permission                          | member | verifier | moderator | admin | superuser |
 * |-------------------------------------|:------:|:--------:|:---------:|:-----:|:---------:|
 * | session: list, revoke (own)         |   ✓    |    ✓     |     ✓     |   ✓   |     ✓     |
 * | quote: verify, correct              |        |    ✓     |           |   ✓   |     ✓     |
 * | quote: withdraw                     |        |          |     ✓     |   ✓   |     ✓     |
 * | report: moderate                    |        |          |     ✓     |   ✓   |     ✓     |
 * | quote: curate                       |        |          |           |   ✓   |     ✓     |
 * | taxonomy: manage                    |        |          |           |   ✓   |     ✓     |
 * | release: preview, publish           |        |          |           |   ✓   |     ✓     |
 * | audit: read                         |        |          |           |   ✓   |     ✓     |
 * | dashboard: counts (sidebar)         |        |    ✓     |     ✓     |   ✓   |     ✓     |
 * | dashboard: read                     |        |          |           |   ✓   |     ✓     |
 * | user: create, list, get, update,    |        |          |           |   ✓   |     ✓     |
 * |   set-password, ban, set-role       |        |          |           |       |           |
 * | user: impersonate, delete           |        |          |           |       |     ✓     |
 * | session: delete (anyone's)          |        |          |           |       |     ✓     |
 *
 * - Verifiers check provenance (the verification queue, wording corrections).
 * - Moderators handle reports and the submissions queue's moderation
 *   decisions (publish, mark disputed, withdraw).
 * - Admins curate, manage authors, sources and topics, build and publish
 *   releases, read the audit log and assign roles. Assigning `superuser` is
 *   the service's to refuse (QOT-44): `set-role` alone cannot tell roles apart.
 * - `superuser` is the bootstrap account (SUPERUSER_EMAIL, created by the
 *   seeder on an empty database), above admin.
 */
const statements = {
	user: [
		'create',
		'list',
		'set-role',
		'ban',
		'impersonate',
		'delete',
		'set-password',
		'get',
		'update'
	],
	session: ['list', 'revoke', 'delete'],
	quote: ['verify', 'correct', 'curate', 'withdraw'],
	report: ['moderate'],
	taxonomy: ['manage'],
	release: ['preview', 'publish'],
	audit: ['read'],
	dashboard: ['read', 'counts']
} as const;

export type PermissionResource = keyof typeof statements;
export type PermissionAction<Resource extends PermissionResource> =
	(typeof statements)[Resource][number];
export type Permission = Partial<{
	[Resource in PermissionResource]: PermissionAction<Resource>[];
}>;

export const ac = createAccessControl(statements);

const ownSessions = { session: ['list', 'revoke'] } as const;

// Member — every signed-in account. Submits, reacts and reports through
// ownership checks in the services, so it needs no statement beyond its own
// sessions.
export const memberAc = ac.newRole({ ...ownSessions });

// Verifier — the verification queue: verify and correct wording.
export const verifierAc = ac.newRole({
	...ownSessions,
	quote: ['verify', 'correct'],
	dashboard: ['counts']
});

// Moderator — reports, and withdrawing content.
export const moderatorAc = ac.newRole({
	...ownSessions,
	quote: ['withdraw'],
	report: ['moderate'],
	dashboard: ['counts']
});

// Admin — everything a verifier and a moderator can do, plus curation,
// taxonomy, releases, the audit log and user administration (role changes
// included; not impersonation or deletion).
export const adminAc = ac.newRole({
	user: ['create', 'list', 'get', 'update', 'set-password', 'ban', 'set-role'],
	...ownSessions,
	quote: ['verify', 'correct', 'curate', 'withdraw'],
	report: ['moderate'],
	taxonomy: ['manage'],
	release: ['preview', 'publish'],
	audit: ['read'],
	dashboard: ['read', 'counts']
});

// Superuser — everything in `statements`.
export const superuserAc = ac.newRole(statements);

/**
 * The canonical role map. Consumed by the runtime auth instance (`app.module.ts`),
 * the standalone tooling instance (`lib/auth.ts`) and {@link hasPermission}, so a
 * new role only has to be added here.
 */
export const roles = {
	member: memberAc,
	verifier: verifierAc,
	moderator: moderatorAc,
	admin: adminAc,
	superuser: superuserAc
};

/** The role every new account starts with (better-auth's `defaultRole`). */
export const DEFAULT_ROLE = 'member';

export type RoleName = keyof typeof roles;

/**
 * The roles above each have a differently-typed `authorize` (their statements
 * differ), so indexing the map yields a union that TypeScript will not let us
 * call. Structurally they are all the same function.
 */
interface AuthorizableRole {
	authorize: (permission: Permission) => { success: boolean };
}

const roleRegistry = roles as Record<string, AuthorizableRole | undefined>;

/** How a role arrives: a comma-separated string, an array, or absent. */
export type RoleInput = string | string[] | null | undefined;

/**
 * Better-auth lets a user hold several roles, and hands them over as either a
 * **comma-separated string** or an **array** (`UserSession['user'].role` is
 * typed `string | string[]`). Anything inspecting a role has to normalise both,
 * so that lives here. A missing role reads as the default role, not "no roles".
 */
export const rolesOf = (role: RoleInput): string[] =>
	(Array.isArray(role) ? role : (role || DEFAULT_ROLE).split(','))
		.map((name) => name.trim())
		.filter(Boolean);

/**
 * Whether a (possibly multi-) role includes a specific one.
 *
 * Use this instead of `role === 'superuser'`: the equality silently fails for a
 * user holding `"admin,superuser"`, and doesn't compile against the array form.
 */
export const hasRole = (role: RoleInput, name: string): boolean =>
	rolesOf(role).includes(name);

/**
 * Check a role against a permission, without a database round-trip.
 *
 * Use where better-auth's `@UserHasPermission` decorator cannot reach — notably
 * websocket message handlers, which never pass through the HTTP `AuthGuard`.
 *
 * A multi-role user is granted the union of their roles; a user with no role
 * gets the plugin's `defaultRole`.
 */
export const hasPermission = (
	role: RoleInput,
	permission: Permission
): boolean =>
	rolesOf(role)
		// An unrecognized role grants nothing rather than everything.
		.some((name) => roleRegistry[name]?.authorize(permission).success ?? false);
