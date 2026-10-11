import { Body, Controller, Delete, Headers, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { Op, Returns } from 'common/decorators';
import { OKEntity, ok } from 'common/entity';
import { DATASET_HEADER, RegisterDevice } from '../dto';
import { DeviceEntity } from '../entity';
import { DevicesService } from '../services';

/**
 * The CLI's side of `qotm login` / `qotm logout` (BUILD-PLAN §5). The CLI
 * calls these with the bearer token the device flow issued.
 */
@ApiTags('Devices')
@Controller({ path: 'me/devices', version: '1' })
export class DevicesController {
	constructor(private service: DevicesService) {}

	@Post()
	@Op(
		'me/devices/register',
		'/v1/me/devices',
		'Register the terminal this token was issued to (qotm login)'
	)
	@ApiHeader({
		name: 'X-Qotm-Dataset',
		required: false,
		description: 'The dataset version the terminal holds (v2026.09.1).'
	})
	@Returns(DeviceEntity)
	register(
		@Body({ schema: RegisterDevice }) body: RegisterDevice,
		@Session() { user, session }: UserSession,
		@Headers(DATASET_HEADER) dataset?: string
	) {
		return this.service.register(user.id, session.id, body, dataset);
	}

	@Delete('current')
	@Op(
		'me/devices/current/delete',
		'/v1/me/devices/current',
		'Log this terminal out (qotm logout): revokes it and ends its token'
	)
	@Returns(OKEntity)
	async logout(@Session() { session }: UserSession) {
		await this.service.logout(session.id);
		return ok();
	}
}
