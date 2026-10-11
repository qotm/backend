import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
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
import { OKEntity, ok } from 'common/entity';
import { QuoteEntity } from 'quotes/entity';
import { EditQuote, MyQuotesQuery, SubmitPrivate } from '../dto';
import { MyQuotesEntity } from '../entity';
import { SubmissionsService } from '../services';

/** The signed-in member's own quotes. Someone else's quote is a 404. */
@ApiTags('My quotes')
@Controller({ path: 'me/quotes', version: '1' })
export class MyQuotesController {
	constructor(private service: SubmissionsService) {}

	@Get()
	@Op(
		'me/quotes',
		'/v1/me/quotes',
		'My quotes: private ones and my submissions'
	)
	@Returns(MyQuotesEntity)
	mine(
		@Query({ schema: MyQuotesQuery }) query: MyQuotesQuery,
		@Session() { user }: UserSession
	) {
		return this.service.mine(user.id, query);
	}

	@Patch(':id')
	@Op('me/quotes/:id/update', '/v1/me/quotes/:id', 'Edit a private quote')
	@IdParam()
	@Returns(QuoteEntity)
	@ApiNotFoundResponse({ description: 'Not one of your quotes' })
	@ApiConflictResponse({ description: 'Only a private quote can be edited' })
	edit(
		@Param('id') id: string,
		@Body({ schema: EditQuote }) body: EditQuote,
		@Session() { user }: UserSession
	) {
		return this.service.edit(user.id, id, body);
	}

	@Delete(':id')
	@Op(
		'me/quotes/:id/delete',
		'/v1/me/quotes/:id',
		'Delete a private quote, or withdraw a submission still in review'
	)
	@IdParam()
	@Returns(OKEntity)
	@ApiNotFoundResponse({ description: 'Not one of your quotes' })
	@ApiConflictResponse({ description: 'Public: a moderator withdraws it' })
	async remove(@Param('id') id: string, @Session() { user }: UserSession) {
		await this.service.remove(user.id, id);
		return ok();
	}

	@Post(':id/submit')
	@HttpCode(200)
	@Op(
		'me/quotes/:id/submit',
		'/v1/me/quotes/:id/submit',
		'Submit a private quote as a community original'
	)
	@IdParam()
	@Returns(QuoteEntity)
	@ApiNotFoundResponse({ description: 'Not one of your quotes' })
	@ApiConflictResponse({ description: 'Not a private quote' })
	submit(
		@Param('id') id: string,
		@Body({ schema: SubmitPrivate }) body: SubmitPrivate,
		@Session() { user }: UserSession
	) {
		return this.service.submitPrivate(user.id, id, body);
	}
}
