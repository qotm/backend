export enum MailJob {
	Activation = 'activation',
	ActivationTwofa = 'activation-twofa',
	ForgotPassword = 'forgot-password',
	PasswordChanged = 'password-changed',
	ResetPassword = 'reset-password',
	SetPassword = 'set-password',
	Welcome = 'welcome',
	MagicLink = 'magic-link',
	ReviewFinished = 'review-finished'
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

export interface MagicLinkData {
	to: string;
	url: string;
	/** How long the link works, for the copy ("expires in 10 minutes"). */
	expiresInMinutes: number;
}

/** A review decision on a member's submission (QOT-53). */
export type ReviewFinishedOutcome =
	| 'VERIFY'
	| 'NEEDS_EVIDENCE'
	| 'REJECT'
	| 'PUBLISH'
	| 'MARK_DISPUTED'
	| 'WITHDRAW'
	| 'CURATE'
	| 'KEEP_OUT';

export interface ReviewFinishedData {
	to: string;
	handle: string;
	outcome: ReviewFinishedOutcome;
	quote: { id: string; text: string };
	/** The reviewer's note, as they wrote it; the template escapes it. */
	note: string | null;
	/** The quote's page. */
	url: string;
}
