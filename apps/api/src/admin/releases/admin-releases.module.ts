import { Module } from '@nestjs/common';
import { ReleasesModule } from 'releases/releases.module';
import { AdminReleasesController } from './controllers';
import { AdminReleasesService } from './services';

/** Admin › Dataset releases (QOT-46). */
@Module({
	imports: [ReleasesModule],
	controllers: [AdminReleasesController],
	providers: [AdminReleasesService]
})
export class AdminReleasesModule {}
