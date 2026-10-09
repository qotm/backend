import { z } from 'zod';
import { CommonFilters } from 'common/dto';

export const UserFilters = CommonFilters.extend({
	// Whether any user holds this role is checked in UsersService, against the DB.
	role: z.string().optional()
});
export type UserFilters = z.output<typeof UserFilters>;
