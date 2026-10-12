import * as React from 'react';
import { EmailProps, MagicLinkData } from 'common/types';
import MainLayout, {
	Action,
	Button,
	Fine,
	Heading,
	LinkFallback
} from './main-layout';

/** The sign-in (and sign-up) link. Quiet, no exclamation marks (brand voice). */
const MagicLink = ({
	url,
	expiresInMinutes,
	...props
}: EmailProps<MagicLinkData>) => {
	return (
		<MainLayout
			{...props}
			reason="Sent because someone asked to sign in with this address."
		>
			<Heading eyebrow="Sign-in link" title="Sign in to qotm.">
				Use the button below to sign in. New here? The same link creates your
				account.
			</Heading>
			<Action caption={`Works once · expires in ${expiresInMinutes} minutes`}>
				<Button href={url}>Sign in to qotm&nbsp;&nbsp;→</Button>
			</Action>
			<LinkFallback url={url} />
			<Fine>
				Didn’t ask to sign in? Ignore this email. Nobody can sign in as you
				without this link.
			</Fine>
		</MainLayout>
	);
};

export default MagicLink;
