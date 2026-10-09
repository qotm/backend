import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { LoggerService } from 'common/services';
import { S3Service } from '../services';

@Injectable()
@Processor('media')
export class MediaProcessor extends WorkerHost {
	constructor(
		private readonly s3: S3Service,
		private readonly logger: LoggerService
	) {
		super();
	}

	async process(job: Job<string, any, any>): Promise<void> {
		if (job.name === 'delete-file') {
			if (!this.s3.isHostedUrl(job.data)) {
				this.logger.warn(
					{ jobId: job.id, jobName: job.name },
					'Not a hosted URL; skipping delete.'
				);
				return;
			}
			const key = this.s3.getKeyFromUrl(job.data);
			await this.s3.deleteFile(key);
			await job.updateProgress(100);
		}
	}

	@OnWorkerEvent('completed')
	onCompleted(job: Job<string, any, any>) {
		this.logger.info({ jobId: job.id, jobName: job.name }, 'File deleted.');
	}

	@OnWorkerEvent('failed')
	onFailed(job: Job, err: Error) {
		this.logger.error(
			{ err, jobId: job.id, jobName: job.name },
			'File delete failed.'
		);
	}
}
