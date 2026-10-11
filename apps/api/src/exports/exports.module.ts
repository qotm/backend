import { Module } from '@nestjs/common';
import { QueueModule } from 'common/modules';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { EXPORTS_QUEUE, ExportJobs } from './jobs';

/** The `exports` queue's producer and the export downloads (QOT-45, QOT-52). */
@Module({
	imports: [QueueModule.register(EXPORTS_QUEUE)],
	controllers: [ExportsController],
	providers: [ExportJobs, ExportsService],
	exports: [ExportJobs]
})
export class ExportsModule {}
