import { Controller, Get, Param, Res } from '@nestjs/common';
import {
	ApiConflictResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { Op, Returns } from 'common/decorators';
import { QuotePermissions } from 'admin/review/decorators';
import { ExportStatusEntity } from './exports.entity';
import { ExportsService } from './exports.service';

/** The requesting admin's CSV exports (POST /v1/admin/quotes/export). */
@ApiTags('Admin · Quotes')
@QuotePermissions('curate')
@Controller({ path: 'admin/exports', version: '1' })
export class ExportsController {
	constructor(private service: ExportsService) {}

	@Get(':id')
	@Op('admin/exports/:id', '/v1/admin/exports/:id', 'An export’s progress')
	@ApiParam({ name: 'id', type: String })
	@Returns(ExportStatusEntity)
	@ApiNotFoundResponse({ description: 'Unknown, expired, or someone else’s' })
	status(@Param('id') id: string, @Session() { user }: UserSession) {
		return this.service.status(id, user.id);
	}

	@Get(':id/download')
	@ApiOperation({
		operationId: 'admin/exports/:id/download',
		summary: '/v1/admin/exports/:id/download',
		description: 'The CSV, once the export is ready.'
	})
	@ApiParam({ name: 'id', type: String })
	@ApiOkResponse({
		content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } }
	})
	@ApiNotFoundResponse({ description: 'Unknown, expired, or someone else’s' })
	@ApiConflictResponse({ description: 'Not ready yet' })
	async download(
		@Param('id') id: string,
		@Session() { user }: UserSession,
		@Res() res: Response
	) {
		const file = await this.service.file(id, user.id);
		res.setHeader('Cache-Control', 'private, no-store');
		res.attachment(file.name);
		res.type('text/csv; charset=utf-8').send(file.body);
	}
}
