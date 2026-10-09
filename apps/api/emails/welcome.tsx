import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailProps, WelcomeData } from 'common/types';
import MainLayout, { Salutation, CN, CTAButton } from './main-layout';

const Welcome = ({
	firstName,
	clientLoginPage,
	...props
}: EmailProps<WelcomeData>) => {
	return (
		<MainLayout {...props}>
			<Salutation name={firstName} />
			<Text className={CN.text}>
				{
					"Welcome! Your account is all set, and we're excited to have you here. You can now start using the application by clicking the button below."
				}
			</Text>

			<CTAButton text="Go to your dashboard" url={clientLoginPage} />
			<Text className={CN.text}>
				If the button above doesn't work, copy and paste the link below into
				your browser:
			</Text>
			<Text
				className={`text-xs underline underline-offset-2 text-[#525f7f] select-all break-all`}
			>
				{clientLoginPage}
			</Text>
			<Text className={CN.text}>
				{
					'If you ever need help or have questions, our support team is always happy to assist you.'
				}
			</Text>
		</MainLayout>
	);
};

export default Welcome;
