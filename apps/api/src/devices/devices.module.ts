import { Module } from '@nestjs/common';
import { DevicesController } from './controllers';
import { DevicesService } from './services';

/** Terminals signed in with `qotm login` (QOT-36). */
@Module({
	controllers: [DevicesController],
	providers: [DevicesService],
	exports: [DevicesService]
})
export class DevicesModule {}
