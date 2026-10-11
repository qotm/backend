import { applyDecorators } from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import type { PermissionAction } from 'lib/access';

/** Typed wrappers over `UserHasPermission` for the review statements. */
export function QuotePermissions(...actions: PermissionAction<'quote'>[]) {
	return applyDecorators(UserHasPermission({ permission: { quote: actions } }));
}

export function ReportPermissions(...actions: PermissionAction<'report'>[]) {
	return applyDecorators(
		UserHasPermission({ permission: { report: actions } })
	);
}
