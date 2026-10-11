import { Module } from '@nestjs/common';
import {
	AdminAuthorsController,
	AdminSourcesController,
	AdminTopicsController
} from './controllers';
import { AdminTaxonomyService } from './services';

/** Admin CRUD for authors, sources and topics (QOT-43). */
@Module({
	controllers: [
		AdminAuthorsController,
		AdminSourcesController,
		AdminTopicsController
	],
	providers: [AdminTaxonomyService]
})
export class AdminTaxonomyModule {}
