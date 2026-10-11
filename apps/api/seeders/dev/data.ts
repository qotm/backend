import type {
	QuoteStatus,
	QuoteType,
	ReportReason,
	ReportStatus,
	SourceKind
} from '@qotm/db/enums';

/**
 * The design's sample content (qotm canvas), as a development dataset. Where
 * the artboards show one quote in different states, each quote keeps one
 * state, chosen so every status badge appears at least once. Counts of likes
 * and favorites are real rows, not the artboards' display numbers.
 */

/** Development-only password for every sample member. */
export const DEV_PASSWORD = 'secret';

/** The design's roles. QOT-27 replaces the template roles with these. */
export type DesignRole = 'member' | 'verifier' | 'moderator' | 'admin';

export const MEMBERS: {
	handle: string;
	name: string;
	role: DesignRole;
	bio?: string;
	showFavorites?: boolean;
}[] = [
	{
		handle: 'ada',
		name: 'Ada Mensah',
		role: 'verifier',
		bio: 'Reads old papers so you don’t have to.',
		showFavorites: true
	},
	{ handle: 'kofi', name: 'Kofi Boateng', role: 'moderator' },
	{ handle: 'mireille', name: 'Mireille Laurent', role: 'admin' },
	{ handle: 'lena', name: 'Lena Fischer', role: 'member' },
	{ handle: 'tomas', name: 'Tomás Ortega', role: 'member' }
];

export const AUTHORS: {
	slug: string;
	name: string;
	bornYear?: number;
	diedYear?: number;
	description?: string;
}[] = [
	{
		slug: 'dijkstra',
		name: 'Edsger W. Dijkstra',
		bornYear: 1930,
		diedYear: 2002,
		description: 'computer scientist'
	},
	{ slug: 'kernighan', name: 'Brian W. Kernighan', bornYear: 1942 },
	{ slug: 'hoare', name: 'C. A. R. Hoare', bornYear: 1934 },
	{ slug: 'knuth', name: 'Donald E. Knuth', bornYear: 1938 },
	{ slug: 'abelson-sussman', name: 'Harold Abelson & Gerald Jay Sussman' },
	{ slug: 'karlton', name: 'Phil Karlton', bornYear: 1947, diedYear: 1997 },
	{ slug: 'torvalds', name: 'Linus Torvalds' },
	{ slug: 'beck', name: 'Kent Beck' }
];

export const SOURCES: {
	key: string;
	title: string;
	author: string;
	year: number;
	kind: SourceKind;
	url?: string;
}[] = [
	{
		key: 'ewd498',
		title: 'EWD 498: How do we tell truths that might hurt?',
		author: 'dijkstra',
		year: 1975,
		kind: 'MANUSCRIPT',
		url: 'https://www.cs.utexas.edu/~EWD/transcriptions/EWD04xx/EWD498.html'
	},
	{
		key: 'elements',
		title: 'The Elements of Programming Style',
		author: 'kernighan',
		year: 1978,
		kind: 'BOOK'
	},
	{
		key: 'sicp',
		title: 'Structure and Interpretation of Computer Programs',
		author: 'abelson-sussman',
		year: 1985,
		kind: 'BOOK'
	},
	{
		key: 'emperor',
		title: 'The Emperor’s Old Clothes',
		author: 'hoare',
		year: 1981,
		kind: 'LECTURE'
	},
	{
		key: 'goto',
		title: 'Structured Programming with go to Statements',
		author: 'knuth',
		year: 1974,
		kind: 'PAPER'
	}
];

export interface SampleQuote {
	publicId: string;
	text: string;
	type: QuoteType;
	status: QuoteStatus;
	contributor: string;
	topics: string[];
	author?: string;
	source?: string;
	work?: string;
	year?: number;
	context?: string;
	/** For DISPUTED: the status it held when the dispute began. */
	beforeDispute?: QuoteStatus;
	/** The note on the final review decision, shown to the submitter. */
	note?: string;
}

export const QUOTES: SampleQuote[] = [
	// Canonical track
	{
		publicId: 'q_8f2k1c',
		text: 'Simplicity is prerequisite for reliability.',
		type: 'CANONICAL',
		status: 'DATASET_RELEASE',
		contributor: 'kofi',
		author: 'dijkstra',
		source: 'ewd498',
		work: 'EWD 498',
		year: 1975,
		context:
			'From a list of short, deliberately provocative remarks on the state of computing.',
		topics: ['simplicity', 'software-design']
	},
	{
		publicId: 'q_3m9d0a',
		text: 'Programs must be written for people to read, and only incidentally for machines to execute.',
		type: 'CANONICAL',
		status: 'DATASET_RELEASE',
		contributor: 'ada',
		author: 'abelson-sussman',
		source: 'sicp',
		work: 'Structure and Interpretation of Computer Programs',
		year: 1985,
		topics: ['programming', 'learning']
	},
	{
		publicId: 'q_1t7c4e',
		text: 'Debugging is twice as hard as writing the code in the first place.',
		type: 'CANONICAL',
		status: 'DATASET_RELEASE',
		contributor: 'kofi',
		author: 'kernighan',
		source: 'elements',
		work: 'The Elements of Programming Style',
		year: 1978,
		topics: ['debugging']
	},
	{
		publicId: 'q_0h5w3q',
		text: 'There are two ways of constructing a software design: one way is to make it so simple that there are obviously no deficiencies, and the other way is to make it so complicated that there are no obvious deficiencies.',
		type: 'CANONICAL',
		status: 'DATASET_RELEASE',
		contributor: 'kofi',
		author: 'hoare',
		source: 'emperor',
		work: 'The Emperor’s Old Clothes',
		year: 1981,
		topics: ['complexity', 'software-design']
	},
	{
		publicId: 'q_6f1k9s',
		text: 'Controlling complexity is the essence of computer programming.',
		type: 'CANONICAL',
		status: 'DATASET_RELEASE',
		contributor: 'ada',
		author: 'kernighan',
		work: 'Software Tools',
		year: 1976,
		topics: ['complexity', 'programming']
	},
	{
		publicId: 'q_7c1m4t',
		text: 'The question of whether a computer can think is no more interesting than the question of whether a submarine can swim.',
		type: 'CANONICAL',
		status: 'CURATED',
		contributor: 'ada',
		author: 'dijkstra',
		work: 'EWD 898',
		year: 1984,
		topics: ['programming', 'learning']
	},
	{
		publicId: 'q_2x7v3m',
		text: 'Make it work, make it right, make it fast.',
		type: 'CANONICAL',
		status: 'CURATED',
		contributor: 'mireille',
		author: 'beck',
		topics: ['software-engineering']
	},
	{
		publicId: 'q_2p9e6d',
		text: 'Program testing can be used to show the presence of bugs, but never to show their absence!',
		type: 'CANONICAL',
		status: 'CURATION_REVIEW',
		contributor: 'mireille',
		author: 'dijkstra',
		work: 'Notes on Structured Programming',
		year: 1970,
		topics: ['debugging', 'software-engineering']
	},
	{
		publicId: 'q_8n4r2b',
		text: 'The most effective debugging tool is still careful thought, coupled with judiciously placed print statements.',
		type: 'CANONICAL',
		status: 'VERIFIED',
		contributor: 'mireille',
		author: 'kernighan',
		work: 'Unix for Beginners',
		year: 1979,
		topics: ['debugging', 'unix']
	},
	{
		publicId: 'q_9b5n2k',
		text: 'Talk is cheap. Show me the code.',
		type: 'CANONICAL',
		status: 'VERIFIED',
		contributor: 'mireille',
		author: 'torvalds',
		work: 'linux-kernel mailing list',
		year: 2000,
		topics: ['open-source']
	},
	{
		publicId: 'q_5k0q2j',
		text: 'Premature optimization is the root of all evil.',
		type: 'CANONICAL',
		status: 'UNDER_REVIEW',
		contributor: 'ada',
		author: 'knuth',
		source: 'goto',
		work: 'Structured Programming with go to Statements',
		year: 1974,
		topics: ['programming']
	},
	{
		publicId: 'q_6h2w8r',
		text: 'There are only two hard things in Computer Science: cache invalidation and naming things.',
		type: 'CANONICAL',
		status: 'NEEDS_EVIDENCE',
		contributor: 'ada',
		author: 'karlton',
		topics: ['programming'],
		note: 'A verifier needs a primary source.'
	},
	{
		publicId: 'q_1z8c7y',
		text: 'Weeks of coding can save you hours of planning.',
		type: 'CANONICAL',
		status: 'SUBMITTED',
		contributor: 'lena',
		topics: ['software-engineering']
	},
	// Outcomes
	{
		publicId: 'q_5d3a8w',
		text: 'If debugging is the process of removing software bugs, then programming must be the process of putting them in.',
		type: 'CANONICAL',
		status: 'DISPUTED',
		beforeDispute: 'CURATED',
		contributor: 'kofi',
		author: 'dijkstra',
		topics: ['debugging']
	},
	{
		publicId: 'q_r3j8x0',
		text: 'Premature optimization is the root of all evil.',
		type: 'CANONICAL',
		status: 'REJECTED',
		contributor: 'tomas',
		author: 'hoare',
		topics: ['programming'],
		note: 'Knuth wrote this, in his 1974 paper; it is already in qotm as q_5k0q2j.'
	},
	{
		publicId: 'q_w1d7r3',
		text: 'Talk is cheap. Show me the code.',
		type: 'CANONICAL',
		status: 'WITHDRAWN',
		contributor: 'lena',
		author: 'torvalds',
		topics: ['open-source'],
		note: 'Duplicate of q_9b5n2k.'
	},
	// Original track
	{
		publicId: 'q_4r8y1p',
		text: 'A green build is a hypothesis, not a proof.',
		type: 'ORIGINAL',
		status: 'CURATION_CANDIDATE',
		contributor: 'ada',
		topics: ['software-engineering']
	},
	{
		publicId: 'q_3j7u5x',
		text: 'Read the error message twice before you read the code once.',
		type: 'ORIGINAL',
		status: 'COMMUNITY_DISCOVERY',
		contributor: 'kofi',
		topics: ['debugging']
	},
	{
		publicId: 'q_9s2v6m',
		text: 'Every abstraction is a promise someone will have to keep at 3 a.m.',
		type: 'ORIGINAL',
		status: 'PUBLISHED',
		contributor: 'ada',
		topics: ['software-design']
	},
	{
		publicId: 'q_7w2e9n',
		text: 'Make it work, make it right, make it fast.',
		type: 'ORIGINAL',
		status: 'ORIGINALITY_CHECK',
		contributor: 'kofi',
		topics: ['software-engineering']
	},
	// Private
	{
		publicId: 'q_p7v2k9',
		text: 'Debugging is twice as hard as writing the code in the first place.',
		type: 'PRIVATE',
		status: 'PRIVATE',
		contributor: 'ada',
		topics: ['debugging']
	}
];

/** The originality check's find on the Submissions artboard. */
export const MATCHES = [
	{ quote: 'q_7w2e9n', matched: 'q_2x7v3m', method: 'FUZZY', score: 0.97 }
] as const;

/** The verifier on every canonical quote that reached VERIFIED. */
export const VERIFIER = 'mireille';

export const REPORTS: {
	number: number;
	quote: string;
	reporter: string;
	reason: ReportReason;
	status: ReportStatus;
	details?: string;
}[] = [
	{
		number: 412,
		quote: 'q_5d3a8w',
		reporter: 'lena',
		reason: 'ATTRIBUTION',
		status: 'DISPUTED',
		details:
			'This is usually traced to a talk, not to Dijkstra’s writing. I can’t find it in the EWD archive.'
	},
	{
		number: 415,
		quote: 'q_7w2e9n',
		reporter: 'mireille',
		reason: 'DUPLICATE',
		status: 'UNDER_REVIEW'
	},
	{
		number: 416,
		quote: 'q_3j7u5x',
		reporter: 'tomas',
		reason: 'CONTENT',
		status: 'SUBMITTED'
	}
];

/** Reactions as `[member, quote]` pairs. */
export const LIKES: [string, string][] = [
	['ada', 'q_1t7c4e'],
	['ada', 'q_8f2k1c'],
	['kofi', 'q_8f2k1c'],
	['lena', 'q_8f2k1c'],
	['tomas', 'q_8f2k1c'],
	['kofi', 'q_4r8y1p'],
	['lena', 'q_4r8y1p'],
	['mireille', 'q_3j7u5x'],
	['ada', 'q_6h2w8r'],
	['tomas', 'q_9b5n2k']
];

export const FAVORITES: [string, string][] = [
	['ada', 'q_8f2k1c'],
	['ada', 'q_3m9d0a'],
	['ada', 'q_0h5w3q'],
	['kofi', 'q_1t7c4e'],
	['lena', 'q_8f2k1c'],
	['mireille', 'q_7c1m4t']
];

export const RECOMMENDATIONS: [string, string][] = [
	['kofi', 'q_4r8y1p'],
	['lena', 'q_4r8y1p'],
	['tomas', 'q_4r8y1p'],
	['ada', 'q_3j7u5x']
];

/** Three published releases and the preview after them (Dataset releases). */
export const RELEASES: {
	version: string;
	state: 'PUBLISHED' | 'PREVIEW';
	publishedBy?: string;
	date: string;
	quotes: string[];
}[] = [
	{
		version: 'v2026.08.1',
		state: 'PUBLISHED',
		publishedBy: 'kofi',
		date: '2026-08-04',
		quotes: ['q_8f2k1c', 'q_3m9d0a', 'q_1t7c4e']
	},
	{
		version: 'v2026.08.2',
		state: 'PUBLISHED',
		publishedBy: 'mireille',
		date: '2026-08-18',
		quotes: ['q_8f2k1c', 'q_3m9d0a', 'q_1t7c4e', 'q_0h5w3q']
	},
	{
		version: 'v2026.08.3',
		state: 'PUBLISHED',
		publishedBy: 'mireille',
		date: '2026-08-30',
		quotes: ['q_8f2k1c', 'q_3m9d0a', 'q_1t7c4e', 'q_0h5w3q', 'q_6f1k9s']
	},
	{
		version: 'v2026.09.1',
		state: 'PREVIEW',
		date: '2026-09-26',
		quotes: [
			'q_8f2k1c',
			'q_3m9d0a',
			'q_1t7c4e',
			'q_0h5w3q',
			'q_6f1k9s',
			'q_7c1m4t',
			'q_2x7v3m'
		]
	}
];

/** The knuth quote's wording fix (Audit log: "Corrected wording"). */
export const CORRECTIONS = [
	{
		quote: 'q_5k0q2j',
		oldText: 'Premature optimisation is the root of all evil.',
		actor: 'ada',
		note: 'Matched to the 1974 paper'
	}
];
