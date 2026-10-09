import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Module({})
export class QueueModule {
	static register(name: string) {
		const queue = BullModule.registerQueue({ name });
		const board = BullBoardModule.forFeature({
			name,
			adapter: BullMQAdapter
		});

		@Module({
			imports: [queue, board],
			exports: [queue, board]
		})
		class DynamicQueueModule {}

		return DynamicQueueModule;
	}
}
