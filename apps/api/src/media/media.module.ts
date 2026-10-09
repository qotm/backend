import { Global, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { QueueModule } from 'common/modules';
import { S3Service, MediaService } from './services';
import { MediaProcessor } from './processors';

@Global()
@Module({
	imports: [
		MulterModule.register({
			storage: memoryStorage() // use memory storage for having the buffer
		}),
		QueueModule.register('media')
	],
	controllers: [],
	providers: [S3Service, MediaService, MediaProcessor],
	exports: [MediaService]
})
export class MediaModule {}
