import * as React from 'react';
import {
	EmailProps,
	ReviewFinishedData,
	ReviewFinishedOutcome
} from 'common/types';
import MainLayout, {
	Action,
	bare,
	Button,
	Fine,
	Heading,
	Note,
	QuoteBlock,
	Terminal
} from './main-layout';

/**
 * What each outcome means for the member, in the brand's quiet voice: the
 * subject, the line under it, and the eyebrow's mono glyph and state word
 * (states differ by word and glyph, never by hue).
 */
export const REVIEW_COPY: Record<
	ReviewFinishedOutcome,
	{ subject: string; body: string; glyph: string; state: string }
> = {
	VERIFY: {
		subject: 'Your quote was verified',
		body: 'A verifier checked it against its source. It is public now, with your credit.',
		glyph: '✓',
		state: 'Verified'
	},
	NEEDS_EVIDENCE: {
		subject: 'Your quote needs evidence',
		body: 'A verifier could not confirm it from the source given. Add a source that shows these words to keep it moving.',
		glyph: '?',
		state: 'Needs evidence'
	},
	REJECT: {
		subject: 'Your quote was not verified',
		body: 'A verifier could not confirm that these words were said. It will not be published.',
		glyph: '×',
		state: 'Not verified'
	},
	PUBLISH: {
		subject: 'Your original was published',
		body: 'It is public now, declared original by you.',
		glyph: '✓',
		state: 'Published'
	},
	MARK_DISPUTED: {
		subject: 'Your original is disputed',
		body: 'A moderator found a possible earlier attribution. It stays up while it is reviewed.',
		glyph: '⚑',
		state: 'Disputed'
	},
	WITHDRAW: {
		subject: 'Your quote was withdrawn',
		body: 'It is no longer public. Its page keeps its history.',
		glyph: '×',
		state: 'Withdrawn'
	},
	CURATE: {
		subject: 'Your quote was curated',
		body: 'It ships to every qotm install with the next dataset release.',
		glyph: '★',
		state: 'Curated'
	},
	KEEP_OUT: {
		subject: 'Your quote stays out of the dataset for now',
		body: 'Curators did not pick it for the CLI this time. It stays public.',
		glyph: '○',
		state: 'Not curated'
	}
};

/** Author credit and contributor credit stay apart (qotm_kit, Credit). */
const credit = (quote: ReviewFinishedData['quote'], handle: string) =>
	quote.original
		? `Declared original by @${handle}`
		: quote.author
			? `— ${quote.author}`
			: `submitted by @${handle}`;

/**
 * A review of the member's submission finished. Needs evidence sends them to
 * their quotes in review, where "Add evidence" is; a curated quote shows the
 * command that brings it to their terminal. Text only: React escapes it.
 */
const ReviewFinished = ({
	handle,
	outcome,
	quote,
	note,
	url,
	...props
}: EmailProps<ReviewFinishedData>) => {
	const copy = REVIEW_COPY[outcome];
	const curated = outcome === 'CURATE';
	const evidence = outcome === 'NEEDS_EVIDENCE';
	const href = evidence ? `${props.site}/my-quotes?tab=review` : url;
	return (
		<MainLayout {...props} reason="Sent about your submission.">
			<Heading
				eyebrow={`${copy.glyph} ${copy.state} · Review finished`}
				title={`${copy.subject}.`}
			>
				Hi @{handle}. {copy.body}
			</Heading>
			<QuoteBlock
				text={quote.text}
				credit={credit(quote, handle)}
				id={quote.id}
			/>
			{note ? (
				<Note label={evidence ? 'The verifier’s note' : 'The reviewer’s note'}>
					{note}
				</Note>
			) : null}
			{curated ? (
				<Terminal
					command="qotm sync"
					comment="picks it up once the next release is out"
				/>
			) : null}
			<Action caption={bare(href)}>
				<Button href={href} variant={curated ? 'outline' : 'solid'}>
					{evidence ? 'Add evidence' : 'Open the quote'}&nbsp;&nbsp;→
				</Button>
			</Action>
			<Fine>
				You get these because review emails are on in your settings. Turn them
				off at {bare(props.site)}/settings.
			</Fine>
		</MainLayout>
	);
};

export default ReviewFinished;
