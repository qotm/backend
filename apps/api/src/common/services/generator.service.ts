import { Injectable } from '@nestjs/common';
import { v4 as ID } from 'uuid';
import { createId as CUID } from '@paralleldrive/cuid2';
import moment from 'moment';
import crypto from 'crypto';
import { generate } from 'randomstring';

@Injectable()
export class GeneratorService {
	avatar(name: string) {
		const seed = name.toLowerCase().replace(' ', '+');
		const options = `seed=${seed}%size=500`;
		return `https://api.dicebear.com/7.x/initials/png?${options}`;
	}

	numeric(length: number) {
		return generate({ charset: 'numeric', length });
	}

	alphabet = (size = 64) => {
		return crypto.randomBytes(size).toString('hex');
	};

	uuid() {
		return ID();
	}

	cuid() {
		return CUID();
	}

	now() {
		return moment.utc();
	}

	currentDate() {
		return new Date().toISOString().slice(0, 10);
	}

	currentHour() {
		return new Date().toISOString().slice(0, 13);
	}

	addPrefix(prefix: string, text: string, delimiter = ':') {
		return prefix + delimiter + text;
	}

	expiry(
		amount: moment.DurationInputArg1,
		unit: moment.unitOfTime.DurationConstructor
	) {
		return this.now().add(amount, unit);
	}
}
