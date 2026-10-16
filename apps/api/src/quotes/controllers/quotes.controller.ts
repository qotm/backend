import {
	Controller,
	Get,
	NotFoundException,
	Param,
	Query
} from '@nestjs/common';
import { ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import {
	OptionalAuth,
	Session,
	type UserSession
} from '@thallesp/nestjs-better-auth';
import { IdParam, Op, Returns } from 'common/decorators';
import { QuotesService } from '../services';
import { QuoteFeedQuery } from '../dto';
import {
	QuoteCardEntity,
	QuoteEntity,
	QuoteFeedEntity,
	RelatedQuotesEntity
} from '../entity';

/**
 * The public quote reads. No session is needed; with one, each quote carries
 * the viewer's own like/favorite/recommend state and the viewer can open their
 * own quotes that are not public yet.
 */
@ApiTags('Quotes')
@OptionalAuth()
@Controller({ path: 'quotes', version: '1' })
export class QuotesController {
	constructor(private service: QuotesService) {}

	@Get()
	@Op('quotes', '/v1/quotes', 'A feed of quotes: discover, latest or curated')
	@Returns(QuoteFeedEntity)
	feed(
		@Query({ schema: QuoteFeedQuery }) query: QuoteFeedQuery,
		@Session() session?: UserSession | null
	) {
		return this.service.feed(query, session?.user.id);
	}

	@Get('today')
	@Op(
		'quotes/today',
		'/v1/quotes/today',
		"Today's quote: a short curated programming quote, the same for everyone on a UTC day"
	)
	@Returns(QuoteCardEntity)
	@ApiNotFoundResponse({ description: 'Nothing is curated yet' })
	async today() {
		const quote = await this.service.today();
		if (!quote) throw new NotFoundException('No curated quote yet');
		return quote;
	}

	@Get(':id')
	@Op('quotes/:id', '/v1/quotes/:id', 'A quote with its provenance')
	@IdParam()
	@Returns(QuoteEntity)
	@ApiNotFoundResponse({
		description:
			'Unknown, private or not yet checked; or withdrawn (the message says so)'
	})
	findOne(@Param('id') id: string, @Session() session?: UserSession | null) {
		return this.service.findOne(id, session?.user.id);
	}

	@Get(':id/related')
	@Op('quotes/:id/related', '/v1/quotes/:id/related', 'Quotes to read next')
	@IdParam()
	@Returns(RelatedQuotesEntity)
	@ApiNotFoundResponse({ description: 'The quote is not visible' })
	related(@Param('id') id: string, @Session() session?: UserSession | null) {
		return this.service.related(id, session?.user.id);
	}
}
