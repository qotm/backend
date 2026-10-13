import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { QueueModule } from 'common/modules';
import { OgImagesController, ShareImagesController } from './controllers';
import { SHARE_IMAGES_QUEUE, ShareImageJobs } from './jobs';
import { IndexNowService, ShareImagesService } from './services';

/** Share images and og:images (QOT-38); rendered by the worker (QOT-51). */
@Module({
	imports: [
		QueueModule.register(SHARE_IMAGES_QUEUE),
		HttpModule.register({ timeout: 5000 })
	],
	controllers: [ShareImagesController, OgImagesController],
	providers: [ShareImagesService, ShareImageJobs, IndexNowService],
	exports: [ShareImagesService, IndexNowService]
})
export class ShareModule {}
