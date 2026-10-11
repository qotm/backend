import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
	Post,
	Query
} from '@nestjs/common';
import {
	ApiConflictResponse,
	ApiNotFoundResponse,
	ApiTags
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { IdParam, Op, Returns } from 'common/decorators';
import { TaxonomyPermissions } from '../decorators';
import {
	CreateAuthor,
	CreateSource,
	CreateTopic,
	UpdateAuthor,
	UpdateSource,
	UpdateTopic,
	TaxonomyFilters
} from '../dto';
import {
	AdminAuthorEntity,
	AdminSourceEntity,
	AdminTopicEntity,
	PaginatedAdminAuthorEntity,
	PaginatedAdminSourceEntity,
	PaginatedAdminTopicEntity
} from '../entity';
import { AdminTaxonomyService } from '../services';

/** The acting admin, as the audit log records them. */
const actorOf = ({ user }: UserSession) => ({
	id: user.id,
	handle: (user as typeof user & { handle: string }).handle
});

@ApiTags('Admin · Authors')
@TaxonomyPermissions('manage')
@Controller({ path: 'admin/authors', version: '1' })
export class AdminAuthorsController {
	constructor(private service: AdminTaxonomyService) {}

	@Get()
	@Op(
		'admin/authors',
		'/v1/admin/authors',
		'Authors quotes are attributed to, by name, with search and paging'
	)
	@Returns(PaginatedAdminAuthorEntity)
	list(@Query({ schema: TaxonomyFilters }) filters: TaxonomyFilters) {
		return this.service.authors(filters);
	}

	@Post()
	@Op('admin/authors/create', '/v1/admin/authors', 'Add an author (audited)')
	@Returns(AdminAuthorEntity)
	@ApiConflictResponse({ description: 'The slug is taken' })
	create(
		@Body({ schema: CreateAuthor }) body: CreateAuthor,
		@Session() session: UserSession
	) {
		return this.service.createAuthor(body, actorOf(session));
	}

	@Patch(':id')
	@Op('admin/authors/:id', '/v1/admin/authors/:id', 'Edit an author (audited)')
	@IdParam()
	@Returns(AdminAuthorEntity)
	@ApiNotFoundResponse()
	@ApiConflictResponse({ description: 'The slug is taken' })
	update(
		@Param('id') id: string,
		@Body({ schema: UpdateAuthor }) body: UpdateAuthor,
		@Session() session: UserSession
	) {
		return this.service.updateAuthor(id, body, actorOf(session));
	}
}

@ApiTags('Admin · Sources')
@TaxonomyPermissions('manage')
@Controller({ path: 'admin/sources', version: '1' })
export class AdminSourcesController {
	constructor(private service: AdminTaxonomyService) {}

	@Get()
	@Op(
		'admin/sources',
		'/v1/admin/sources',
		'Books, papers, talks and posts, by title, with search and paging'
	)
	@Returns(PaginatedAdminSourceEntity)
	list(@Query({ schema: TaxonomyFilters }) filters: TaxonomyFilters) {
		return this.service.sources(filters);
	}

	@Post()
	@Op('admin/sources/create', '/v1/admin/sources', 'Add a source (audited)')
	@Returns(AdminSourceEntity)
	@ApiConflictResponse({ description: 'The slug is taken' })
	create(
		@Body({ schema: CreateSource }) body: CreateSource,
		@Session() session: UserSession
	) {
		return this.service.createSource(body, actorOf(session));
	}

	@Patch(':id')
	@Op('admin/sources/:id', '/v1/admin/sources/:id', 'Edit a source (audited)')
	@IdParam()
	@Returns(AdminSourceEntity)
	@ApiNotFoundResponse()
	@ApiConflictResponse({ description: 'The slug is taken' })
	update(
		@Param('id') id: string,
		@Body({ schema: UpdateSource }) body: UpdateSource,
		@Session() session: UserSession
	) {
		return this.service.updateSource(id, body, actorOf(session));
	}
}

@ApiTags('Admin · Topics')
@TaxonomyPermissions('manage')
@Controller({ path: 'admin/topics', version: '1' })
export class AdminTopicsController {
	constructor(private service: AdminTaxonomyService) {}

	@Get()
	@Op(
		'admin/topics',
		'/v1/admin/topics',
		'The topic taxonomy, in its order, with search and paging'
	)
	@Returns(PaginatedAdminTopicEntity)
	list(@Query({ schema: TaxonomyFilters }) filters: TaxonomyFilters) {
		return this.service.topics(filters);
	}

	@Post()
	@Op('admin/topics/create', '/v1/admin/topics', 'Add a topic (audited)')
	@Returns(AdminTopicEntity)
	@ApiConflictResponse({ description: 'The slug is taken' })
	create(
		@Body({ schema: CreateTopic }) body: CreateTopic,
		@Session() session: UserSession
	) {
		return this.service.createTopic(body, actorOf(session));
	}

	@Patch(':id')
	@Op('admin/topics/:id', '/v1/admin/topics/:id', 'Edit a topic (audited)')
	@IdParam()
	@Returns(AdminTopicEntity)
	@ApiNotFoundResponse()
	@ApiConflictResponse({ description: 'The slug is taken' })
	update(
		@Param('id') id: string,
		@Body({ schema: UpdateTopic }) body: UpdateTopic,
		@Session() session: UserSession
	) {
		return this.service.updateTopic(id, body, actorOf(session));
	}
}
