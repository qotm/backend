import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
	MailJob,
	ActivationData,
	ActivationTwoFaData,
	WelcomeData,
	ForgotPasswordData,
	SetPasswordData
} from 'common/types';

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
}
