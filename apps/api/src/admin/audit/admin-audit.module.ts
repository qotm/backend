import { Module } from '@nestjs/common';
import { AdminAuditController } from './controllers';
import { AdminAuditService } from './services';

/** The audit log for admins (QOT-47). */
@Module({
	controllers: [AdminAuditController],
	providers: [AdminAuditService]
})
export class AdminAuditModule {}
