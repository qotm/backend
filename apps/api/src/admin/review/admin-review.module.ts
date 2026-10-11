import { Module } from '@nestjs/common';
import { QuotesModule } from 'quotes/quotes.module';
import {
	AdminCurationController,
	AdminReportsController,
	AdminSubmissionsController,
	AdminVerificationController
} from './controllers';
import { ReviewService } from './services';

/** The submissions, verification (QOT-40), curation (QOT-41) and report (QOT-42) queues. */
@Module({
	imports: [QuotesModule],
	controllers: [
		AdminSubmissionsController,
		AdminVerificationController,
		AdminCurationController,
		AdminReportsController
	],
	providers: [ReviewService]
})
export class AdminReviewModule {}
