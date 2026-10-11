import { Module } from '@nestjs/common';
import { QueueModule } from 'common/modules';
import { QuotesModule } from 'quotes/quotes.module';
import {
	MatchController,
	MyQuotesController,
	SubmissionsController
} from './controllers';
import { MATCHING_QUEUE, MatchService, SubmissionsService } from './services';

@Module({
	imports: [QuotesModule, QueueModule.register(MATCHING_QUEUE)],
	controllers: [SubmissionsController, MatchController, MyQuotesController],
	providers: [SubmissionsService, MatchService],
	exports: [MatchService]
})
export class SubmissionsModule {}
