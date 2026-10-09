import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailBaseProps } from 'common/types';
import MainLayout, { Salutation, CN } from './main-layout';

const PasswordChanged = ({ ...props }: EmailBaseProps) => {
	return (
		<MainLayout {...props}>
			<Salutation />
			<Text className={CN.text}>
				{
					'Your password was successfully changed. You can now sign in using your new credentials.'
				}
			</Text>
			<Text className={CN.text}>
				{
					"If you didn't make this change or notice anything unusual, please reach out to our support team right away so we can help secure your account."
				}
			</Text>
		</MainLayout>
	);
};

export default PasswordChanged;
