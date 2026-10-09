import { Factory } from 'fishery';
import type { z } from 'zod';
import { CommonFilters } from 'common/dto';
import { UserFilters } from 'users/dto';

export class Dto {
	/**
	 * Run a request schema over `plain` the way the validation pipe does, and
	 * return the Zod result (`success`, then `data` or `error`).
	 */
	static parse<T extends z.ZodType>(schema: T, plain: unknown) {
		return schema.safeParse(plain);
	}

	static get commonFilters() {
		return Factory.define<CommonFilters>(() => ({}));
	}

	static get userFilters() {
		return Factory.define<UserFilters>(() => ({
			page: 1,
			limit: 10
		}));
	}
}
