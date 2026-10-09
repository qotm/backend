import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailProps, ActivationData } from 'common/types';
import MainLayout, { Salutation, CN, CTAButton } from './main-layout';

const Activation = ({
	firstName,
	url,
	...props
}: EmailProps<ActivationData>) => {
	return (
		<MainLayout {...props}>
			<Salutation name={firstName} />
			<Text className={CN.text}>
				{
					'You are nearly there! To complete your account setup, please confirm your email address by clicking the button below.'
				}
			</Text>
			<CTAButton text="Activate your account" url={url} />
			<Text className={CN.text}>
				If the button above doesn't work, copy and paste the link below into
				your browser:
			</Text>
			<Text
				className={`text-xs underline underline-offset-2 text-[#525f7f] select-all break-all`}
			>
				{url}
			</Text>
			<Text className={CN.text}>
				For security reasons, this activation link will expire in one hour.
			</Text>
		</MainLayout>
	);
};

export default Activation;
