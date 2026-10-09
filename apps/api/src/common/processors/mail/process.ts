import { Job } from 'bullmq';
import { ISendMailOptions } from '@nestjs-modules/mailer';
import { render } from '@react-email/render';
import Activation from '@emails/activation';
import ActivationTwofa from '@emails/activation-twofa';
import Welcome from '@emails/welcome';
import ForgotPassword from '@emails/forgot-password';
import PasswordChanged from '@emails/password-changed';
import ResetPassword from '@emails/reset-password';
import SetPassword from '@emails/set-password';
import {
	MailJob,
	EmailGlobalProps,
	ActivationData,
	ActivationTwoFaData,
	WelcomeData,
	SetPasswordData,
	ForgotPasswordData
} from 'common/types';

type Options = Omit<ISendMailOptions, 'from'>;

abstract class ProcessAbstract<T> {
	abstract subject: string;
	abstract preview?: string;

	constructor(
		protected readonly job: Job<T, any, string>,
		protected readonly globals: EmailGlobalProps
	) {}

	abstract process(): Options;
}

class ActivationProcess extends ProcessAbstract<ActivationData> {
	subject = 'Account Activation';
	preview = 'Activate your account!';

	process(): Options {
		const {
			subject,
			preview,
			job: {
				data: { to, firstName, token, url }
			}
		} = this;
		const html = render(
			Activation({ ...this.globals, subject, preview, firstName, token, url })
		);
		return { to, subject, html };
	}
}

class ActivationTwofaProcess extends ProcessAbstract<ActivationTwoFaData> {
	subject = 'Enable Two Factor Authentication';
	preview = 'Scan the code!';

	process(): Options {
		const {
			subject,
			preview,
			job: {
				data: { to, firstName, qrcode }
			}
		} = this;
		const html = render(
			ActivationTwofa({ ...this.globals, subject, preview, firstName })
		);
		return {
			to,
			subject,
			html,
			attachments: [
				{
					filename: 'qrcode.png',
					path: qrcode,
					cid: 'qrcode'
				}
			]
		};
	}
}

class ForgotPasswordProcess extends ProcessAbstract<ForgotPasswordData> {
	subject = 'Password Reset Request';
	preview = 'Reset your password!';

	process(): Options {
		const {
			subject,
			preview,
			job: {
				data: { to, token, url }
			}
		} = this;
		const html = render(
			ForgotPassword({
				...this.globals,
				subject,
				preview,
				token,
				url
			})
		);
		return { to, subject, html };
	}
}

class WelcomeProcess extends ProcessAbstract<WelcomeData> {
	subject = `Welcome aboard 🎉`;
	preview = 'Your account has been activated!';

	process(): Options {
		const {
			subject,
			preview,
			job: {
				data: { to, firstName, clientLoginPage, supportEmail }
			}
		} = this;
		const html = render(
			Welcome({
				...this.globals,
				firstName,
				subject,
				preview,
				clientLoginPage,
				supportEmail
			})
		);
		return { to, subject, html };
	}
}

class SetPasswordProcess extends ProcessAbstract<SetPasswordData> {
	subject = 'Account Created';
	preview = 'Set your account password!';

	process(): Options {
		const {
			subject,
			preview,
			job: {
				data: { to, firstName, token }
			}
		} = this;
		const html = render(
			SetPassword({
				...this.globals,
				firstName,
				subject,
				preview,
				token
			})
		);
		return { to, subject, html };
	}
}

class ResetPasswordProcess extends ProcessAbstract<string> {
	subject = 'Password Reset';
	preview = 'New password created!';

	process(): Options {
		const {
			subject,
			preview,
			job: { data: to }
		} = this;
		const html = render(
			ResetPassword({
				...this.globals,
				subject,
				preview
			})
		);
		return { to, subject, html };
	}
}

class PasswordChangedProcess extends ProcessAbstract<string> {
	subject = 'Password Changed';
	preview = 'New password created!';

	process(): Options {
		const {
			subject,
			preview,
			job: { data: to }
		} = this;
		const html = render(
			PasswordChanged({
				...this.globals,
				subject,
				preview
			})
		);
		return { to, subject, html };
	}
}

export class ProcessFactory {
	private static jobs = {
		[MailJob.Activation]: ActivationProcess,
		[MailJob.ActivationTwofa]: ActivationTwofaProcess,
		[MailJob.Welcome]: WelcomeProcess,
		[MailJob.ForgotPassword]: ForgotPasswordProcess,
		[MailJob.ResetPassword]: ResetPasswordProcess,
		[MailJob.PasswordChanged]: PasswordChangedProcess,
		[MailJob.SetPassword]: SetPasswordProcess
	};

	private static getProcess(name: MailJob) {
		const entry = Object.entries(ProcessFactory.jobs).find(
			(item) => item[0] === name
		);
		return entry ? entry[1] : null;
	}

	static init(job: Job<any, any, string>, globals: EmailGlobalProps) {
		const Process = ProcessFactory.getProcess(job.name as MailJob);
		if (!Process) return null;
		return new Process(job, globals);
	}
}
