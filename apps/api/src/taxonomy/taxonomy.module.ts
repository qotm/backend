import { Module } from '@nestjs/common';
import { AuthorsController, TopicsController } from './controllers';
import { TaxonomyService } from './services';

/** Public topic and author reads (QOT-31). */
@Module({
	controllers: [TopicsController, AuthorsController],
	providers: [TaxonomyService]
})
export class TaxonomyModule {}
