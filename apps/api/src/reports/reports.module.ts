import { Module } from '@nestjs/common';
import { ReportsController } from './controllers';
import { ReportsService } from './services';

@Module({
	controllers: [ReportsController],
	providers: [ReportsService]
})
export class ReportsModule {}
