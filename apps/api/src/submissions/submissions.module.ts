import { Module } from '@nestjs/common';
import { QueueModule } from 'common/modules';
import { QuotesModule } from 'quotes/quotes.module';
import { ShareModule } from 'share/share.module';
import {
	MatchController,
	MyQuotesController,
	SubmissionsController
} from './controllers';
import {
	MATCHING_QUEUE,
	MatchService,
	OriginalityEvents,
	SubmissionsService
} from './services';

@Module({
	imports: [QuotesModule, ShareModule, QueueModule.register(MATCHING_QUEUE)],
	controllers: [SubmissionsController, MatchController, MyQuotesController],
	providers: [SubmissionsService, MatchService, OriginalityEvents],
	exports: [MatchService]
})
export class SubmissionsModule {}
