import { z } from 'zod';
import { CommonFilters } from 'common/dto';

export const UserFilters = CommonFilters.extend({
	// Whether any user holds this role is checked in UsersService, against the DB.
	role: z.string().optional()
});
export type UserFilters = z.output<typeof UserFilters>;

/** The roles an admin may assign. `superuser` is never assigned (BUILD-PLAN §5). */
export const ASSIGNABLE_ROLES = [
	'member',
	'verifier',
	'moderator',
	'admin'
] as const;

export const SetRole = z.object({
	role: z.enum(ASSIGNABLE_ROLES).meta({ example: 'moderator' })
});
export type SetRole = z.output<typeof SetRole>;
