import {
	Body,
	Controller,
	Get,
	HttpCode,
	Param,
	Post,
	Query
} from '@nestjs/common';
import {
	ApiConflictResponse,
	ApiNotFoundResponse,
	ApiParam,
	ApiTags
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { Op, Returns } from 'common/decorators';
import { ReleasePermissions } from '../decorators';
import { PublishRelease, ReleaseListQuery } from '../dto';
import { AdminReleasesEntity, ReleaseJobEntity } from '../entity';
import { AdminReleasesService } from '../services';

/** The acting admin, as the audit log records them. */
const actorOf = ({ user }: UserSession) => ({
	id: user.id,
	handle: (user as typeof user & { handle: string }).handle
});

@ApiTags('Admin · Dataset releases')
@Controller({ path: 'admin/releases', version: '1' })
export class AdminReleasesController {
	constructor(private service: AdminReleasesService) {}

	@Get()
	@Op(
		'admin/releases',
		'/v1/admin/releases',
		'The release in progress, whether a build is running, and the published releases'
	)
	@Returns(AdminReleasesEntity)
	@ReleasePermissions('preview')
	list(@Query({ schema: ReleaseListQuery }) query: ReleaseListQuery) {
		return this.service.list(query);
	}

	@Post('preview')
	@HttpCode(202)
	@Op(
		'admin/releases/preview',
		'/v1/admin/releases/preview',
		'Queue a preview build of the next release (one build at a time)'
	)
	@Returns(ReleaseJobEntity)
	@ApiConflictResponse({ description: 'A build is already running' })
	@ReleasePermissions('preview')
	preview(@Session() session: UserSession) {
		return this.service.preview(actorOf(session));
	}

	@Post(':version/publish')
	@HttpCode(202)
	@Op(
		'admin/releases/:version/publish',
		'/v1/admin/releases/:version/publish',
		'Queue the publish of a reviewed preview'
	)
	@ApiParam({ name: 'version', type: String, example: 'v2026.09.1' })
	@Returns(ReleaseJobEntity)
	@ApiNotFoundResponse()
	@ApiConflictResponse({
		description: 'No preview built, already published, or a build running'
	})
	@ReleasePermissions('publish')
	publish(
		@Param('version') version: string,
		@Body({ schema: PublishRelease }) _body: PublishRelease,
		@Session() session: UserSession
	) {
		return this.service.publish(version, actorOf(session));
	}
}
