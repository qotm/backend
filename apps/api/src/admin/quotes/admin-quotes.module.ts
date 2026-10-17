import { Module } from '@nestjs/common';
import { ExportsModule } from 'exports/exports.module';
import { ShareModule } from 'share/share.module';
import { AdminQuotesController } from './controllers';
import { AdminQuotesService } from './services';

/** Admin › Quotes and its CSV export trigger (QOT-45). */
@Module({
	imports: [ExportsModule, ShareModule],
	controllers: [AdminQuotesController],
	providers: [AdminQuotesService]
})
export class AdminQuotesModule {}
