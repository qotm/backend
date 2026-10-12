import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailProps, ForgotPasswordData } from 'common/types';
import MainLayout, { Salutation, CTAButton, CTAFallback } from './main-layout';
import { text } from './theme';

const ForgotPassword = ({ url, ...props }: EmailProps<ForgotPasswordData>) => {
	return (
		<MainLayout {...props}>
			<Salutation />
			<Text style={text.body}>
				{
					'It looks like you requested a password reset. No worries — you can securely set a new password by clicking the button below.'
				}
			</Text>
			<CTAButton text="Reset your password" url={url} />
			<CTAFallback url={url} />
			<Text style={text.body}>
				For security reasons, this activation link will expire in one hour.
			</Text>
		</MainLayout>
	);
};

export default ForgotPassword;
