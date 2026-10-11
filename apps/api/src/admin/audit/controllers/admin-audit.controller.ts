import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Op, Returns } from 'common/decorators';
import { AuditPermissions } from '../decorators';
import { AuditQuery } from '../dto';
import { AuditActionListEntity, PaginatedAuditEntryEntity } from '../entity';
import { AdminAuditService } from '../services';

@ApiTags('Admin · Audit log')
@AuditPermissions('read')
@Controller({ path: 'admin/audit', version: '1' })
export class AdminAuditController {
	constructor(private service: AdminAuditService) {}

	@Get()
	@Op(
		'admin/audit',
		'/v1/admin/audit',
		'Who changed what, and why: newest first, searchable, by action'
	)
	@Returns(PaginatedAuditEntryEntity)
	list(@Query({ schema: AuditQuery }) query: AuditQuery) {
		return this.service.list(query);
	}

	@Get('actions')
	@Op(
		'admin/audit/actions',
		'/v1/admin/audit/actions',
		'Every audited action with its label, for the filter'
	)
	@Returns(AuditActionListEntity)
	actions() {
		return this.service.actions();
	}
}
