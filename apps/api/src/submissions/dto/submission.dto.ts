import { z } from 'zod';

const QUOTE_MARKS = /^["“”„'‘’«»]+|["“”„'‘’«»]+$/g;

/**
 * The quote's words: trimmed, whitespace collapsed, and without the quotation
 * marks people paste around them (the form says "without quotation marks").
 * At most 280 characters once cleaned.
 */
export const quoteText = () =>
	z
		.string()
		.transform((text) =>
			text.replace(/\s+/g, ' ').trim().replace(QUOTE_MARKS, '').trim()
		)
		.pipe(z.string().min(3).max(280))
		.meta({ example: 'Premature optimization is the root of all evil.' });

const topics = z
	.array(z.string().max(60))
	.max(5)
	.meta({ example: ['programming'], description: 'Topic slugs.' });

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.transform((v) => v || undefined);

const url = z
	.url({ protocol: /^https?$/ })
	.max(2048)
	.optional();

const canonical = z.object({
	type: z.literal('canonical'),
	text: quoteText(),
	attribution: z
		.string()
		.trim()
		.min(2)
		.max(160)
		.meta({ example: 'Donald E. Knuth' }),
	source: z
		.string()
		.trim()
		.min(2)
		.max(300)
		.meta({ example: 'Structured Programming with go to Statements' }),
	year: z.number().int().min(-3000).max(2100).optional(),
	sourceUrl: url,
	context: optionalText(1000),
	topics: topics.min(1)
});

const original = z.object({
	type: z.literal('original'),
	text: quoteText(),
	topics: topics.min(1),
	/** "I wrote this quote and have the right to publish it." */
	rights: z.literal(true, {
		error: 'Confirm you wrote this quote and may publish it'
	})
});

const personal = z.object({
	type: z.literal('private'),
	text: quoteText(),
	attribution: optionalText(160),
	source: optionalText(300),
	year: z.number().int().min(-3000).max(2100).optional(),
	sourceUrl: url,
	context: optionalText(1000),
	topics: topics.default([])
});

export const SubmitQuote = z
	.discriminatedUnion('type', [canonical, original, personal])
	.meta({ id: 'SubmitQuote' });
export type SubmitQuote = z.output<typeof SubmitQuote>;

export const MatchQuote = z
	.object({
		text: z.string().max(400),
		/** Leave a quote out of its own match (when editing). */
		exclude: z
			.string()
			.regex(/^q_[0-9a-z]{6}$/)
			.optional()
	})
	.meta({ id: 'MatchQuote' });
export type MatchQuote = z.output<typeof MatchQuote>;

export const MY_QUOTE_TABS = ['all', 'private', 'review', 'public'] as const;

export const MyQuotesQuery = z.object({
	tab: z.enum(MY_QUOTE_TABS).default('all'),
	cursor: z
		.string()
		.regex(/^q_[0-9a-z]{6}$/)
		.optional(),
	limit: z.coerce.number().int().min(1).max(50).default(20)
});
export type MyQuotesQuery = z.output<typeof MyQuotesQuery>;

/** Edits to a private quote. */
export const EditQuote = z
	.object({
		text: quoteText().optional(),
		attribution: z.string().trim().max(160).nullable().optional(),
		source: z.string().trim().max(300).nullable().optional(),
		year: z.number().int().min(-3000).max(2100).nullable().optional(),
		sourceUrl: z
			.url({ protocol: /^https?$/ })
			.max(2048)
			.nullable()
			.optional(),
		context: z.string().trim().max(1000).nullable().optional(),
		topics: topics.optional()
	})
	.meta({ id: 'EditQuote' });
export type EditQuote = z.output<typeof EditQuote>;

/** Submitting a private quote as a community original. */
export const SubmitPrivate = z
	.object({
		rights: z.literal(true, {
			error: 'Confirm you wrote this quote and may publish it'
		}),
		topics: topics.min(1).optional()
	})
	.meta({ id: 'SubmitPrivate' });
export type SubmitPrivate = z.output<typeof SubmitPrivate>;

/** New evidence for a quote a verifier sent back. */
export const AddEvidence = z
	.object({
		note: z
			.string()
			.trim()
			.min(3)
			.max(1000)
			.meta({ example: 'First published in the 1974 paper, p. 268.' }),
		sourceUrl: url,
		source: optionalText(300)
	})
	.meta({ id: 'AddEvidence' });
export type AddEvidence = z.output<typeof AddEvidence>;
