import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiConflictResponse,
	ApiTags
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { Op, Returns } from 'common/decorators';
import { OKEntity, ok } from 'common/entity';
import { DeleteMe, UpdateMe } from '../dto';
import { MeEntity } from '../entity';
import { MeService } from '../services';

/** Settings: the member's own account. Terminals are in devices/. */
@ApiTags('Me')
@Controller({ path: 'me', version: '1' })
export class MeController {
	constructor(private service: MeService) {}

	@Get()
	@Op('me', '/v1/me', 'My account')
	@Returns(MeEntity)
	get(@Session() { user }: UserSession) {
		return this.service.get(user.id);
	}

	@Patch()
	@Op('me/update', '/v1/me', 'Update my profile, handle, bio and preferences')
	@Returns(MeEntity)
	@ApiConflictResponse({ description: 'The handle is taken' })
	update(
		@Body({ schema: UpdateMe }) body: UpdateMe,
		@Session() { user }: UserSession
	) {
		return this.service.update(user.id, body);
	}

	@Delete()
	@Op(
		'me/delete',
		'/v1/me',
		'Delete my account: private quotes go, public ones stay credited to "a former member"'
	)
	@Returns(OKEntity)
	@ApiBadRequestResponse({ description: 'The confirmation is not your handle' })
	@ApiConflictResponse({
		description: 'The superuser account cannot be deleted'
	})
	async delete(
		@Body({ schema: DeleteMe }) body: DeleteMe,
		@Session() { user }: UserSession
	) {
		await this.service.delete(user.id, body);
		return ok();
	}
}
