import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { Op, Returns } from 'common/decorators';
import { AuthorEntity, TopicEntity, TopicListEntity } from '../entity';
import { TaxonomyService } from '../services';

/** Public: the topic pages and pickers. The quotes themselves come from GET /v1/quotes?topic=…. */
@ApiTags('Topics')
@AllowAnonymous()
@Controller({ path: 'topics', version: '1' })
export class TopicsController {
	constructor(private service: TaxonomyService) {}

	@Get()
	@Op('topics', '/v1/topics', 'Every topic, with its quote and curated counts')
	@Returns(TopicListEntity)
	list() {
		return this.service.topics();
	}

	@Get(':slug')
	@Op('topics/:slug', '/v1/topics/:slug', 'One topic, with its counts')
	@ApiParam({ name: 'slug', type: String })
	@Returns(TopicEntity)
	@ApiNotFoundResponse()
	one(@Param('slug') slug: string) {
		return this.service.topic(slug);
	}
}

/** Public: the author page's header. Its quotes come from GET /v1/quotes?author=…&state=…. */
@ApiTags('Authors')
@AllowAnonymous()
@Controller({ path: 'authors', version: '1' })
export class AuthorsController {
	constructor(private service: TaxonomyService) {}

	@Get(':slug')
	@Op(
		'authors/:slug',
		'/v1/authors/:slug',
		'An author: lifespan line, topics and tab counts'
	)
	@ApiParam({ name: 'slug', type: String })
	@Returns(AuthorEntity)
	@ApiNotFoundResponse()
	one(@Param('slug') slug: string) {
		return this.service.author(slug);
	}
}
