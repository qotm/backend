import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailProps, WelcomeData } from 'common/types';
import MainLayout, { CTAFallback, Salutation, CTAButton } from './main-layout';
import { text } from './theme';

const Welcome = ({
	firstName,
	clientLoginPage,
	...props
}: EmailProps<WelcomeData>) => {
	return (
		<MainLayout {...props}>
			<Salutation name={firstName} />
			<Text style={text.body}>
				{
					"Welcome! Your account is all set, and we're excited to have you here. You can now start using the application by clicking the button below."
				}
			</Text>

			<CTAButton text="Go to your dashboard" url={clientLoginPage} />
			<CTAFallback url={clientLoginPage} />
			<Text style={text.body}>
				{
					'If you ever need help or have questions, our support team is always happy to assist you.'
				}
			</Text>
		</MainLayout>
	);
};

export default Welcome;
