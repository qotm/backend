import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
	MailJob,
	ActivationData,
	ActivationTwoFaData,
	WelcomeData,
	ForgotPasswordData,
	SetPasswordData,
	MagicLinkData,
	ReviewFinishedData
} from 'common/types';
import { FAILED_JOBS_KEPT } from 'common/constants/jobs';

@Injectable()
export class MailService {
	constructor(@InjectQueue('mail') private mail: Queue) {}

	activation = (data: ActivationData) => {
		this.mail.add(MailJob.Activation, data);
	};

	activationTwofa = (data: ActivationTwoFaData) => {
		this.mail.add(MailJob.ActivationTwofa, data);
	};

	welcome = (data: WelcomeData) => {
		this.mail.add(MailJob.Welcome, data);
	};

	forgotPassword = (data: ForgotPasswordData) => {
		this.mail.add(MailJob.ForgotPassword, data);
	};

	resetPassword = (data: string) => {
		this.mail.add(MailJob.ResetPassword, data);
	};

	passwordChanged = (data: string) => {
		this.mail.add(MailJob.PasswordChanged, data);
	};

	setPassword = (data: SetPasswordData) => {
		this.mail.add(MailJob.SetPassword, data);
	};

	/** The sign-in link. Retried: it is the only way in. */
	magicLink = (data: MagicLinkData) => {
		this.mail.add(MailJob.MagicLink, data, {
			attempts: 5,
			backoff: { type: 'exponential', delay: 5_000 }
		});
	};

	/** A review of the member's submission finished (they opted in). */
	reviewFinished = (data: ReviewFinishedData) => {
		return this.mail.add(MailJob.ReviewFinished, data, {
			attempts: 3,
			backoff: { type: 'exponential', delay: 30_000 },
			removeOnFail: FAILED_JOBS_KEPT
		});
	};
}
