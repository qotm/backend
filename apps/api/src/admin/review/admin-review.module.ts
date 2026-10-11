import { Module } from '@nestjs/common';
import { QuotesModule } from 'quotes/quotes.module';
import {
	AdminCurationController,
	AdminSubmissionsController,
	AdminVerificationController
} from './controllers';
import { ReviewService } from './services';

/** The submissions, verification (QOT-40) and curation (QOT-41) queues. */
@Module({
	imports: [QuotesModule],
	controllers: [
		AdminSubmissionsController,
		AdminVerificationController,
		AdminCurationController
	],
	providers: [ReviewService]
})
export class AdminReviewModule {}
