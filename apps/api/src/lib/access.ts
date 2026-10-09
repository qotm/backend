import { createAccessControl } from 'better-auth/plugins/access';

/**
 * Permission statements — the vocabulary every authorization check draws from.
 *
 * Add a resource here and it is immediately available to
 * `@UserHasPermission({ permission: { <resource>: ['<action>'] } })` on HTTP
 * routes, to `@WsPermissions(...)` on websocket handlers, and to
 * {@link hasPermission} for offline checks. Grant it to a role below, or it is
 * held by nobody but `superuser`.
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
	session: ['list', 'revoke', 'delete']
} as const;

export type PermissionResource = keyof typeof statements;
export type PermissionAction<Resource extends PermissionResource> =
	(typeof statements)[Resource][number];
export type Permission = Partial<{
	[Resource in PermissionResource]: PermissionAction<Resource>[];
}>;

export const ac = createAccessControl(statements);

// Regular user — may manage their own sessions and nothing else. Ownership of a
// resource is checked in the service, not granted here, so a user acting on
// their own content needs no statement at all.
export const userAc = ac.newRole({
	session: ['list', 'revoke']
});

// Admin — user administration, but not role assignment or deletion.
export const adminAc = ac.newRole({
	user: ['create', 'list', 'get', 'update', 'set-password', 'ban'],
	session: ['list', 'revoke']
});

// Superuser — everything in `statements`.
export const superuserAc = ac.newRole(statements);

/**
 * The canonical role map. Consumed by the runtime auth instance (`app.module.ts`),
 * the standalone tooling instance (`lib/auth.ts`) and {@link hasPermission}, so a
 * new role only has to be added here.
 */
export const roles = {
	user: userAc,
	admin: adminAc,
	superuser: superuserAc
};

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
	(Array.isArray(role) ? role : (role || 'user').split(','))
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
