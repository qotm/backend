import { Module } from '@nestjs/common';
import { QuotesModule } from 'quotes/quotes.module';
import { FavoritesController, ReactionsController } from './controllers';
import { ReactionsService } from './services';

/** Likes, favorites and recommendations (QOT-39). */
@Module({
	imports: [QuotesModule],
	controllers: [ReactionsController, FavoritesController],
	providers: [ReactionsService]
})
export class ReactionsModule {}
