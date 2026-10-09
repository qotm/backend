import { Injectable, Inject, Scope } from '@nestjs/common';
import { INQUIRER } from '@nestjs/core';
import { PinoLogger, Params, PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService extends PinoLogger {
	constructor(
		@Inject(PARAMS_PROVIDER_TOKEN) params: Params,
		@Inject(INQUIRER) parent: object
	) {
		super(params);
		this.setContext(parent?.constructor?.name ?? 'App');
	}
}
