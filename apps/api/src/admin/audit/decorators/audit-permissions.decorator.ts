import { applyDecorators } from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import type { PermissionAction } from 'lib/access';

/** Typed wrapper over `UserHasPermission` for the audit statement. */
export function AuditPermissions(...actions: PermissionAction<'audit'>[]) {
	return applyDecorators(UserHasPermission({ permission: { audit: actions } }));
}
