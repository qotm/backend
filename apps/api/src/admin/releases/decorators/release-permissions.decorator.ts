import { applyDecorators } from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import type { PermissionAction } from 'lib/access';

/** Typed wrapper over `UserHasPermission` for the release statement. */
export function ReleasePermissions(...actions: PermissionAction<'release'>[]) {
	return applyDecorators(
		UserHasPermission({ permission: { release: actions } })
	);
}
