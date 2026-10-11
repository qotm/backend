import { Module } from '@nestjs/common';
import { QuotesModule } from 'quotes/quotes.module';
import {
	AdminSubmissionsController,
	AdminVerificationController
} from './controllers';
import { ReviewService } from './services';

/** The submissions and verification queues (QOT-40). */
@Module({
	imports: [QuotesModule],
	controllers: [AdminSubmissionsController, AdminVerificationController],
	providers: [ReviewService]
})
export class AdminReviewModule {}
