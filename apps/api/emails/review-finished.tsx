import * as React from 'react';
import { Text } from '@react-email/components';
import {
	EmailProps,
	ReviewFinishedData,
	ReviewFinishedOutcome
} from 'common/types';
import MainLayout, { CN, CTAButton } from './main-layout';

/** What each outcome means for the member, in the brand's quiet voice. */
export const REVIEW_COPY: Record<
	ReviewFinishedOutcome,
	{ subject: string; body: string }
> = {
	VERIFY: {
		subject: 'Your quote was verified',
		body: 'A verifier checked it against its source. It is public now, with your credit.'
	},
	NEEDS_EVIDENCE: {
		subject: 'Your quote needs evidence',
		body: 'A verifier could not confirm it from the source given. Add a source that shows these words to keep it moving.'
	},
	REJECT: {
		subject: 'Your quote was not verified',
		body: 'A verifier could not confirm that these words were said. It will not be published.'
	},
	PUBLISH: {
		subject: 'Your original was published',
		body: 'It is public now, declared original by you.'
	},
	MARK_DISPUTED: {
		subject: 'Your original is disputed',
		body: 'A moderator found a possible earlier attribution. It stays up while it is reviewed.'
	},
	WITHDRAW: {
		subject: 'Your quote was withdrawn',
		body: 'It is no longer public. Its page keeps its history.'
	},
	CURATE: {
		subject: 'Your quote was curated',
		body: 'It ships to every qotm install with the next dataset release.'
	},
	KEEP_OUT: {
		subject: 'Your quote stays out of the dataset for now',
		body: 'Curators did not pick it for the CLI this time. It stays public.'
	}
};

/** A review of the member's submission finished. Text only: React escapes it. */
const ReviewFinished = ({
	handle,
	outcome,
	quote,
	note,
	url,
	...props
}: EmailProps<ReviewFinishedData>) => {
	return (
		<MainLayout {...props}>
			<Text className={CN.text}>Hi @{handle},</Text>
			<Text className={CN.text}>{REVIEW_COPY[outcome].body}</Text>
			<Text className="text-base italic text-[#141210]">
				{'“' + quote.text + '”'}
			</Text>
			{note ? (
				<Text className={CN.text}>The reviewer’s note: {note}</Text>
			) : null}
			<CTAButton text="Open the quote" url={url} />
			<Text className={CN.text}>
				You get these because review emails are on in your settings.
			</Text>
		</MainLayout>
	);
};

export default ReviewFinished;
