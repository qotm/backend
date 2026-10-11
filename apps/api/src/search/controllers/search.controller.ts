import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
	OptionalAuth,
	Session,
	type UserSession
} from '@thallesp/nestjs-better-auth';
import { Op, Returns } from 'common/decorators';
import { SearchQuery } from '../dto';
import { SearchEntity } from '../entity';
import { SearchService } from '../services';

/** Public search. With a session, quotes carry the viewer's own state. */
@ApiTags('Search')
@OptionalAuth()
@Controller({ path: 'search', version: '1' })
export class SearchController {
	constructor(private service: SearchService) {}

	@Get()
	@Op(
		'search',
		'/v1/search',
		'Search quotes, authors and topics, with a count for each'
	)
	@Returns(SearchEntity)
	@Throttle({ default: { limit: 60, ttl: 60_000 } })
	search(
		@Query({ schema: SearchQuery }) query: SearchQuery,
		@Session() session?: UserSession | null
	) {
		return this.service.search(query, session?.user.id);
	}
}
