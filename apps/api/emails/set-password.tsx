import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailProps, SetPasswordData } from 'common/types';
import MainLayout, { Salutation, OTP } from './main-layout';
import { text } from './theme';

const SetPassword = ({
	firstName,
	token,
	...props
}: EmailProps<SetPasswordData>) => {
	return (
		<MainLayout {...props}>
			<Salutation name={firstName} />
			<Text style={text.body}>
				{
					'A new account has been created for you using your email. Please use the one-time password below to set your account password.'
				}
			</Text>
			<OTP code={token} />
			<Text style={text.body}>This code will expire in an hour.</Text>
		</MainLayout>
	);
};

export default SetPassword;
