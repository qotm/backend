import * as React from 'react';
import { Text, Img, Link } from '@react-email/components';
import { EmailProps, ActivationTwoFaData } from 'common/types';
import MainLayout, { Salutation } from './main-layout';
import { text, color } from './theme';

interface AProps {
	href: string;
	text: string;
}

const A = ({ href, text }: AProps) => (
	<Link
		style={{ color: color.clay600 }}
		href={href}
		target="_blank"
		rel="noreferrer"
	>
		{text}
	</Link>
);

const ActivationTwofa = ({
	firstName,
	...props
}: EmailProps<Omit<ActivationTwoFaData, 'qrcode'>>) => {
	return (
		<MainLayout {...props}>
			<Salutation name={firstName} />
			<Text style={text.body}>
				{
					'You requested to enable two factor authentication. To configure authentication via TOTP on multiple devices, during setup, scan the QR code using each device at the same time.'
				}
			</Text>
			<Img
				src="cid:qrcode"
				alt="Twofa QR Code"
				title="QR Code"
				width="200px"
				height="200px"
			/>
			<Text style={text.body}>
				A time-based one-time password (TOTP) application automatically
				generates an authentication code that changes after a certain period of
				time. We recommend using cloud-based TOTP apps such as:{' '}
				<A
					href="https://support.1password.com/one-time-passwords"
					text="1Password"
				/>
				, <A href="https://authy.com/guides/github" text="Authy" />,{' '}
				<A href="https://lastpass.com/auth" text="LastPass Authenticator" />,{' '}
				<A href="https://googleauthenticator.net" text="Google Authenticator" />
				,{' '}
				<A
					href="https://www.microsoft.com/en-us/security/mobile-authenticator-app"
					text="Microsoft Authenticator"
				/>{' '}
				and more.
			</Text>
		</MainLayout>
	);
};

export default ActivationTwofa;
