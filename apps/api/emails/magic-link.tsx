import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailProps, MagicLinkData } from 'common/types';
import MainLayout, { CN, CTAButton } from './main-layout';

/** The sign-in (and sign-up) link. Quiet, no exclamation marks (brand voice). */
const MagicLink = ({
	url,
	expiresInMinutes,
	...props
}: EmailProps<MagicLinkData>) => {
	return (
		<MainLayout {...props}>
			<Text className={CN.text}>
				Use this link to sign in to qotm. New here? The same link creates your
				account.
			</Text>
			<CTAButton text="Sign in to qotm" url={url} />
			<Text className={CN.text}>
				It works once and expires in {expiresInMinutes} minutes. If the button
				does not work, paste this into your browser:
			</Text>
			<Text className="text-xs underline underline-offset-2 text-[#525f7f] select-all break-all">
				{url}
			</Text>
			<Text className={CN.text}>
				If you did not ask to sign in, ignore this email: nobody can sign in as
				you without it.
			</Text>
		</MainLayout>
	);
};

export default MagicLink;
