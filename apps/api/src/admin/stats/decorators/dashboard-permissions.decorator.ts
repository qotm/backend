import { applyDecorators } from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import type { PermissionAction } from 'lib/access';

/** Typed wrapper over `UserHasPermission` for the dashboard statement. */
export function DashboardPermissions(
	...actions: PermissionAction<'dashboard'>[]
) {
	return applyDecorators(
		UserHasPermission({ permission: { dashboard: actions } })
	);
}
