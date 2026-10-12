import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailProps, ActivationData } from 'common/types';
import MainLayout, { CTAFallback, Salutation, CTAButton } from './main-layout';
import { text } from './theme';

const Activation = ({
	firstName,
	url,
	...props
}: EmailProps<ActivationData>) => {
	return (
		<MainLayout {...props}>
			<Salutation name={firstName} />
			<Text style={text.body}>
				{
					'You are nearly there! To complete your account setup, please confirm your email address by clicking the button below.'
				}
			</Text>
			<CTAButton text="Activate your account" url={url} />
			<CTAFallback url={url} />
			<Text style={text.body}>
				For security reasons, this activation link will expire in one hour.
			</Text>
		</MainLayout>
	);
};

export default Activation;
