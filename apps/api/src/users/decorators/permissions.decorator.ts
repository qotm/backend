import { applyDecorators } from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import type { PermissionAction, Permission } from 'lib/access';

/**
 * Thin, typed wrappers over better-auth's `UserHasPermission`. Add one per
 * resource you declare in `lib/access.ts` — the `PermissionAction<'x'>` type
 * argument is what makes a typo'd action a compile error instead of a check
 * that silently never passes.
 */
export function UserPermissions(...actions: PermissionAction<'user'>[]) {
	return applyDecorators(UserHasPermission({ permission: { user: actions } }));
}

export function SessionPermissions(...actions: PermissionAction<'session'>[]) {
	return applyDecorators(
		UserHasPermission({ permission: { session: actions } })
	);
}

/** Escape hatch for a multi-resource check. */
export function Permissions(permissions: Permission) {
	return applyDecorators(UserHasPermission({ permissions }));
}
