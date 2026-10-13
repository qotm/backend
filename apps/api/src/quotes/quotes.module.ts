import { Module } from '@nestjs/common';
import { QuotesController, SitemapController } from './controllers';
import { QuotesService, SitemapService } from './services';

@Module({
	controllers: [QuotesController, SitemapController],
	providers: [QuotesService, SitemapService],
	exports: [QuotesService]
})
export class QuotesModule {}
