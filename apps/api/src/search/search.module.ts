import { Module } from '@nestjs/common';
import { QuotesModule } from 'quotes/quotes.module';
import { SearchController } from './controllers';
import { SearchService } from './services';

/** Full-text and typo-tolerant search (QOT-30). */
@Module({
	imports: [QuotesModule],
	controllers: [SearchController],
	providers: [SearchService]
})
export class SearchModule {}
