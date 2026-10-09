import { Controller, Get, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { SWAGGER_OPTIONS } from 'common/constants';
import { Op } from 'common/decorators';

@ApiTags('App')
@Controller()
export class AppController {
	@Get()
	@ApiExcludeEndpoint()
	@Op('index', '/', 'Get basic information about the API')
	@Version(VERSION_NEUTRAL)
	@AllowAnonymous()
	index() {
		const { info } = SWAGGER_OPTIONS;
		return {
			title: info.title,
			description: info.description
		};
	}

	/**
	 * Demonstrates a per-route limit tighter than the global default. Tighten a
	 * route with `@Throttle({ default: { limit, ttl } })`; exempt one with
	 * `@SkipThrottle()`. Note the TTL is in **milliseconds**.
	 */
	@Get('ping')
	@ApiExcludeEndpoint()
	@Op('ping', '/ping', 'Liveness probe with a per-route rate limit')
	@Version(VERSION_NEUTRAL)
	@AllowAnonymous()
	@Throttle({ default: { limit: 30, ttl: 60_000 } })
	ping() {
		return { ok: true };
	}
}
