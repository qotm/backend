import { Module } from '@nestjs/common';
import { QueueModule } from 'common/modules';
import { RELEASES_QUEUE, ReleaseJobs } from './jobs';

/** The `releases` queue's producer (QOT-50, QOT-58). */
@Module({
	imports: [QueueModule.register(RELEASES_QUEUE)],
	providers: [ReleaseJobs],
	exports: [ReleaseJobs]
})
export class ReleasesModule {}
