import { Module } from '@nestjs/common';
import { QueueModule } from 'common/modules';
import { EXPORTS_QUEUE, ExportJobs } from './jobs';

/** The `exports` queue's producer (QOT-45, QOT-52). */
@Module({
	imports: [QueueModule.register(EXPORTS_QUEUE)],
	providers: [ExportJobs],
	exports: [ExportJobs]
})
export class ExportsModule {}
