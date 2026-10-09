import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailProps, SetPasswordData } from 'common/types';
import MainLayout, { Salutation, OTP, CN } from './main-layout';

const SetPassword = ({
	firstName,
	token,
	...props
}: EmailProps<SetPasswordData>) => {
	return (
		<MainLayout {...props}>
			<Salutation name={firstName} />
			<Text className={CN.text}>
				{
					'A new account has been created for you using your email. Please use the one-time password below to set your account password.'
				}
			</Text>
			<OTP code={token} />
			<Text className={CN.text}>This code will expire in an hour.</Text>
		</MainLayout>
	);
};

export default SetPassword;
