export enum MailJob {
	Activation = 'activation',
	ActivationTwofa = 'activation-twofa',
	ForgotPassword = 'forgot-password',
	PasswordChanged = 'password-changed',
	ResetPassword = 'reset-password',
	SetPassword = 'set-password',
	Welcome = 'welcome'
}

export interface EmailGlobalProps {
	host: string;
	appName: string;
	footerText: string;
}

export interface EmailBaseProps extends EmailGlobalProps {
	subject: string;
	preview?: string;
}

export type EmailProps<T extends { to: string }> = Omit<T, 'to'> &
	EmailBaseProps;

export interface ActivationData {
	to: string;
	firstName: string;
	token: string;
	url: string;
}

export interface ActivationTwoFaData {
	to: string;
	firstName: string;
	qrcode: string;
}

export interface ForgotPasswordData {
	to: string;
	token: string;
	url: string;
}

export interface SetPasswordData {
	to: string;
	firstName: string;
	token: string;
}

export interface WelcomeData {
	to: string;
	firstName: string;
	clientLoginPage: string;
	supportEmail: string;
}
