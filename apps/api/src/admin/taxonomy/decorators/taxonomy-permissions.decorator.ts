import { applyDecorators } from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import type { PermissionAction } from 'lib/access';

/** Typed wrapper over `UserHasPermission` for the taxonomy statement. */
export function TaxonomyPermissions(
	...actions: PermissionAction<'taxonomy'>[]
) {
	return applyDecorators(
		UserHasPermission({ permission: { taxonomy: actions } })
	);
}
