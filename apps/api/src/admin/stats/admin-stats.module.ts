import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { StatsController } from './controllers';
import { StatsService } from './services';

/** Admin › Dashboard and the sidebar counts (QOT-48). */
@Module({
	imports: [HttpModule.register({ timeout: 5000 })],
	controllers: [StatsController],
	providers: [StatsService]
})
export class AdminStatsModule {}
