import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { Op, Returns } from 'common/decorators';
import { QuotePermissions } from 'admin/review/decorators';
import {
	AdminQuoteFilters,
	AdminQuoteQuery,
	BulkTopic,
	BulkWithdraw
} from '../dto';
import {
	AdminQuoteListEntity,
	BulkResultEntity,
	ExportJobEntity
} from '../entity';
import { AdminQuotesService } from '../services';

/** The acting admin, as the audit log and the export record them. */
const actorOf = ({ user }: UserSession) => ({
	id: user.id,
	handle: (user as typeof user & { handle: string }).handle
});

/** Admins only: curation is theirs, and so is the full list. */
@ApiTags('Admin · Quotes')
@QuotePermissions('curate')
@Controller({ path: 'admin/quotes', version: '1' })
export class AdminQuotesController {
	constructor(private service: AdminQuotesService) {}

	@Get()
	@Op(
		'admin/quotes',
		'/v1/admin/quotes',
		'Every quote but private ones: search, type and state, with each one’s last release'
	)
	@Returns(AdminQuoteListEntity)
	list(@Query({ schema: AdminQuoteQuery }) query: AdminQuoteQuery) {
		return this.service.list(query);
	}

	@Post('export')
	@HttpCode(202)
	@Op(
		'admin/quotes/export',
		'/v1/admin/quotes/export',
		'Queue a CSV export of the filtered list; poll GET /v1/admin/exports/:id'
	)
	@Returns(ExportJobEntity)
	export(
		@Body({ schema: AdminQuoteFilters }) filters: AdminQuoteFilters,
		@Session() session: UserSession
	) {
		return this.service.export(filters, actorOf(session));
	}

	@Post('bulk/withdraw')
	@HttpCode(200)
	@Op(
		'admin/quotes/bulk/withdraw',
		'/v1/admin/quotes/bulk/withdraw',
		'Withdraw up to 100 quotes, each with the note, its own history step and audit entry; skipped ones say why'
	)
	@Returns(BulkResultEntity)
	withdraw(
		@Body({ schema: BulkWithdraw }) body: BulkWithdraw,
		@Session() session: UserSession
	) {
		return this.service.withdraw(body, actorOf(session));
	}

	@Post('bulk/topic')
	@HttpCode(200)
	@Op(
		'admin/quotes/bulk/topic',
		'/v1/admin/quotes/bulk/topic',
		"Add a topic to up to 100 quotes, or take it off them (never a quote's only topic)"
	)
	@Returns(BulkResultEntity)
	topic(
		@Body({ schema: BulkTopic }) body: BulkTopic,
		@Session() session: UserSession
	) {
		return this.service.topic(body, actorOf(session));
	}
}
