import { Module } from '@nestjs/common';
import { QueueModule } from 'common/modules';
import { ShareImagesController } from './controllers';
import { SHARE_IMAGES_QUEUE, ShareImageJobs } from './jobs';
import { ShareImagesService } from './services';

/** Share images and og:images (QOT-38); rendered by the worker (QOT-51). */
@Module({
	imports: [QueueModule.register(SHARE_IMAGES_QUEUE)],
	controllers: [ShareImagesController],
	providers: [ShareImagesService, ShareImageJobs],
	exports: [ShareImagesService]
})
export class ShareModule {}
