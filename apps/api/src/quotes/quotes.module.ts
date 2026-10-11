import { Module } from '@nestjs/common';
import { QuotesController } from './controllers';
import { QuotesService } from './services';

@Module({
	controllers: [QuotesController],
	providers: [QuotesService],
	exports: [QuotesService]
})
export class QuotesModule {}
