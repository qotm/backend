import { Module } from '@nestjs/common';
import { DevicesModule } from 'devices/devices.module';
import { DatasetController } from './controllers';
import { DatasetService } from './services';

/** The dataset manifest and current release, public (QOT-37). */
@Module({
	imports: [DevicesModule],
	controllers: [DatasetController],
	providers: [DatasetService]
})
export class DatasetModule {}
