import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import {
	ApiConflictResponse,
	ApiNotFoundResponse,
	ApiTags
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { IdParam, Op, Returns } from 'common/decorators';
import { QuoteEntity } from 'quotes/entity';
import { AddEvidence, MatchQuote, SubmitQuote } from '../dto';
import { MatchEntity } from '../entity';
import { MatchService, SubmissionsService } from '../services';

@ApiTags('Submissions')
@Controller({ path: 'submissions', version: '1' })
export class SubmissionsController {
	constructor(private service: SubmissionsService) {}

	@Post()
	@Op(
		'submissions/create',
		'/v1/submissions',
		'Submit a quote. canonical: needs the author and source, then goes to verification · original: needs the rights confirmation, then the originality check · private: stays yours'
	)
	@Returns(QuoteEntity)
	submit(
		@Body({ schema: SubmitQuote }) body: SubmitQuote,
		@Session() { user }: UserSession
	) {
		return this.service.submit(user.id, body);
	}

	@Post(':id/evidence')
	@HttpCode(200)
	@Op(
		'submissions/:id/evidence',
		'/v1/submissions/:id/evidence',
		'Add evidence to a quote a verifier sent back'
	)
	@IdParam()
	@Returns(QuoteEntity)
	@ApiNotFoundResponse({ description: 'Not one of your quotes' })
	@ApiConflictResponse({ description: 'The quote is not waiting for evidence' })
	addEvidence(
		@Param('id') id: string,
		@Body({ schema: AddEvidence }) body: AddEvidence,
		@Session() { user }: UserSession
	) {
		return this.service.addEvidence(user.id, id, body);
	}
}

/** The live match on the submit form. */
@ApiTags('Submissions')
@Controller({ path: 'quotes', version: '1' })
export class MatchController {
	constructor(private service: MatchService) {}

	@Post('match')
	@HttpCode(200)
	@Op(
		'quotes/match',
		'/v1/quotes/match',
		'The closest public quote to some text. Exact (normalised) and fuzzy (trigram) matching. A possible match flags for review; it never decides authorship.'
	)
	@Returns(MatchEntity)
	match(@Body({ schema: MatchQuote }) body: MatchQuote) {
		return this.service.match(body.text, body.exclude);
	}
}
