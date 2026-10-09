import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { CustomConfigService, LoggerService } from 'common/services';
import { EmailGlobalProps } from 'common/types';
import { ProcessFactory } from './process';

@Injectable()
@Processor('mail')
export class MailProcessor extends WorkerHost {
	private readonly globals: EmailGlobalProps;

	constructor(
		private readonly config: CustomConfigService,
		private readonly email: MailerService,
		private readonly logger: LoggerService
	) {
		super();
		this.globals = {
			host: config.app.host,
			appName: config.app.name,
			footerText: `${config.app.name} - ${config.app.host}`
		};
	}

	async process(job: Job<any, any, string>) {
		const helper = ProcessFactory.init(job, this.globals);
		if (helper) {
			const options = helper.process();
			await this.email.sendMail(options);
		}
	}

	@OnWorkerEvent('completed')
	onCompleted(job: Job<any, any, string>) {
		this.logger.info({ jobId: job.id, jobName: job.name }, 'Mail sent.');
	}

	@OnWorkerEvent('failed')
	onFailed(job: Job<any, any, string>, err: Error) {
		this.logger.error(
			{ err, jobId: job.id, jobName: job.name },
			'Mail send failed.'
		);
	}
}
