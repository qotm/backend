import { createId as CUID } from '@paralleldrive/cuid2';
import { faker as F } from '@faker-js/faker';
import crypto from 'crypto';
import { generate } from 'randomstring';

interface EmailOptions {
	firstName?: string | undefined;
	lastName?: string | undefined;
	provider?: string | undefined;
	allowSpecialCharacters?: boolean | undefined;
}

interface UsernameOptions {
	firstName?: string | undefined;
	lastName?: string | undefined;
}

interface PasswordOptions {
	length?: number | undefined;
	memorable?: boolean | undefined;
	pattern?: RegExp | undefined;
	prefix?: string | undefined;
}

const DEFAULT_ROLES = ['superuser', 'admin', 'user'];
const SAMPLE_ROLES = [
	...DEFAULT_ROLES,
	'user_manager',
	'moderator',
	'analytics_user',
	'guest',
	'content_editor'
];

export class Gen {
	static numeric(length: number) {
		return generate({ charset: 'numeric', length });
	}

	static alphabet(size = 64) {
		return crypto.randomBytes(size).toString('hex');
	}

	static uuid() {
		return F.string.uuid();
	}

	static cuid() {
		return CUID();
	}

	static fullName(sex?: 'female' | 'male') {
		return `${F.person.firstName(sex)} ${F.person.lastName(sex)}`;
	}

	static email(options?: EmailOptions) {
		return F.internet.email(options);
	}

	static username(options?: UsernameOptions) {
		return F.internet.userName(options);
	}

	static password(options?: PasswordOptions) {
		return F.internet.password(options);
	}

	static defaultRole() {
		return F.helpers.arrayElement(DEFAULT_ROLES);
	}

	static role() {
		return F.helpers.arrayElement(SAMPLE_ROLES);
	}
}
