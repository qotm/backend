import { Body, Controller, Param, Post } from '@nestjs/common';
import {
	ApiConflictResponse,
	ApiNotFoundResponse,
	ApiTags,
	ApiTooManyRequestsResponse
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { IdParam, Op, Returns } from 'common/decorators';
import { CreateReport } from '../dto';
import { ReportEntity } from '../entity';
import { ReportsService } from '../services';

/** At most this many reports an hour from one client. */
export const REPORTS_PER_HOUR = 10;

@ApiTags('Reports')
@Controller({ path: 'quotes', version: '1' })
export class ReportsController {
	constructor(private service: ReportsService) {}

	@Post(':id/reports')
	@Throttle({ default: { limit: REPORTS_PER_HOUR, ttl: 60 * 60_000 } })
	@Op(
		'quotes/:id/reports',
		'/v1/quotes/:id/reports',
		'Report a quote to the moderators; it stays up while it is reviewed'
	)
	@IdParam()
	@Returns(ReportEntity)
	@ApiNotFoundResponse({ description: 'The quote is not public' })
	@ApiConflictResponse({
		description: 'You already have an open report on this quote'
	})
	@ApiTooManyRequestsResponse()
	create(
		@Param('id') id: string,
		@Body({ schema: CreateReport }) body: CreateReport,
		@Session() { user }: UserSession
	) {
		return this.service.create(user.id, id, body);
	}
}
