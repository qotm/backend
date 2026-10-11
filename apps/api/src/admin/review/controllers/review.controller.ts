import {
	Body,
	Controller,
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
import { QuoteEntity } from 'quotes/entity';
import { QuotePermissions, ReportPermissions } from '../decorators';
import {
	CorrectQuote,
	ModerationDecision,
	QueueQuery,
	VerificationDecision
} from '../dto';
import { QueuePageEntity, SubmissionMatchesEntity } from '../entity';
import { ReviewService } from '../services';

/** The acting reviewer, as the audit log records them. */
const actorOf = ({ user }: UserSession) => ({
	id: user.id,
	handle: (user as typeof user & { handle: string }).handle
});

@ApiTags('Admin · Submissions')
@Controller({ path: 'admin/submissions', version: '1' })
export class AdminSubmissionsController {
	constructor(private service: ReviewService) {}

	@Get()
	@Op(
		'admin/submissions',
		'/v1/admin/submissions',
		'New quotes waiting for their first check, longest-waiting first'
	)
	@Returns(QueuePageEntity)
	@ReportPermissions('moderate')
	queue(@Query({ schema: QueueQuery }) query: QueueQuery) {
		return this.service.queue('submissions', query);
	}

	@Get(':id/match')
	@Op(
		'admin/submissions/:id/match',
		'/v1/admin/submissions/:id/match',
		'Every possible match found for a submission'
	)
	@IdParam()
	@Returns(SubmissionMatchesEntity)
	@ApiNotFoundResponse()
	@ReportPermissions('moderate')
	matches(@Param('id') id: string) {
		return this.service.matches(id);
	}

	@Post(':id/decision')
	@HttpCode(200)
	@Op(
		'admin/submissions/:id/decision',
		'/v1/admin/submissions/:id/decision',
		'Publish, dispute or withdraw an original the originality check held'
	)
	@IdParam()
	@Returns(QuoteEntity)
	@ApiNotFoundResponse()
	@ApiConflictResponse({
		description: 'Not waiting for a moderator, or decided meanwhile'
	})
	@ReportPermissions('moderate')
	decide(
		@Param('id') id: string,
		@Body({ schema: ModerationDecision }) body: ModerationDecision,
		@Session() session: UserSession
	) {
		return this.service.moderate(actorOf(session), id, body);
	}
}

@ApiTags('Admin · Verification')
@Controller({ path: 'admin', version: '1' })
export class AdminVerificationController {
	constructor(private service: ReviewService) {}

	@Get('verification')
	@Op(
		'admin/verification',
		'/v1/admin/verification',
		'Canonical quotes waiting for a verifier, longest-waiting first'
	)
	@Returns(QueuePageEntity)
	@QuotePermissions('verify')
	queue(@Query({ schema: QueueQuery }) query: QueueQuery) {
		return this.service.queue('verification', query);
	}

	@Post('quotes/:id/verification')
	@HttpCode(200)
	@Op(
		'admin/quotes/:id/verification',
		'/v1/admin/quotes/:id/verification',
		'Verify, ask for evidence or reject a canonical quote (the note goes to the submitter)'
	)
	@IdParam()
	@Returns(QuoteEntity)
	@ApiNotFoundResponse()
	@ApiConflictResponse({
		description: 'Not in verification, author not linked, or decided meanwhile'
	})
	@QuotePermissions('verify')
	verify(
		@Param('id') id: string,
		@Body({ schema: VerificationDecision }) body: VerificationDecision,
		@Session() session: UserSession
	) {
		return this.service.verify(actorOf(session), id, body);
	}

	@Patch('quotes/:id')
	@Op(
		'admin/quotes/:id/update',
		'/v1/admin/quotes/:id',
		'Correct a quote: its wording (kept as a Correction), author and source'
	)
	@IdParam()
	@Returns(QuoteEntity)
	@ApiNotFoundResponse()
	@QuotePermissions('correct')
	correct(
		@Param('id') id: string,
		@Body({ schema: CorrectQuote }) body: CorrectQuote,
		@Session() session: UserSession
	) {
		return this.service.correct(actorOf(session), id, body);
	}
}
