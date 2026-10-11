import { Module } from '@nestjs/common';
import { DevicesController } from './controllers';
import { AuthMaintenanceService, DevicesService } from './services';

/** Terminals signed in with `qotm login` (QOT-36), and sign-in upkeep (QOT-54). */
@Module({
	controllers: [DevicesController],
	providers: [DevicesService, AuthMaintenanceService],
	exports: [DevicesService]
})
export class DevicesModule {}
