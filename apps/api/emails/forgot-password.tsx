import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailProps, ForgotPasswordData } from 'common/types';
import MainLayout, {
	Salutation,
	CTAButton,
	CN,
	CTAFallback
} from './main-layout';

const ForgotPassword = ({ url, ...props }: EmailProps<ForgotPasswordData>) => {
	return (
		<MainLayout {...props}>
			<Salutation />
			<Text className={CN.text}>
				{
					'It looks like you requested a password reset. No worries — you can securely set a new password by clicking the button below.'
				}
			</Text>
			<CTAButton text="Reset your password" url={url} />
			<CTAFallback url={url} />
			<Text className={CN.text}>
				For security reasons, this activation link will expire in one hour.
			</Text>
		</MainLayout>
	);
};

export default ForgotPassword;
