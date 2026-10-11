import { z } from 'zod';
import { SourceKind } from '@qotm/db/enums';
import { search } from 'common/schemas';

/** `dijkstra`, `abelson-sussman`, `software-design`. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slug = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.regex(SLUG_PATTERN, 'Lowercase letters, digits and single hyphens');

/** A text field that may be cleared: blank or null both store null. */
const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullable()
		.transform((value) => value || null);

const year = () => z.number().int().min(1).max(9999).nullable();

export const TaxonomyFilters = z.object({
	search: search(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20)
});
export type TaxonomyFilters = z.output<typeof TaxonomyFilters>;

const authorFields = {
	name: z
		.string()
		.trim()
		.min(1)
		.max(160)
		.meta({ example: 'Edsger W. Dijkstra' }),
	slug: slug(80).meta({ example: 'dijkstra' }),
	bornYear: year().meta({ example: 1930 }),
	diedYear: year().meta({ example: 2002 }),
	description: optionalText(80).meta({ example: 'computer scientist' })
};

/** The slug defaults to one made from the name. */
export const CreateAuthor = z.object({
	...authorFields,
	slug: authorFields.slug.optional(),
	bornYear: authorFields.bornYear.optional(),
	diedYear: authorFields.diedYear.optional(),
	description: authorFields.description.optional()
});
export type CreateAuthor = z.output<typeof CreateAuthor>;

export const UpdateAuthor = z
	.object(authorFields)
	.partial()
	.refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type UpdateAuthor = z.output<typeof UpdateAuthor>;

const sourceFields = {
	title: z
		.string()
		.trim()
		.min(1)
		.max(300)
		.meta({ example: 'EWD 498: How do we tell truths that might hurt?' }),
	/** The author's slug; null for none. */
	author: slug(80).nullable().meta({ example: 'dijkstra' }),
	year: year().meta({ example: 1975 }),
	kind: z.enum(SourceKind),
	url: z
		.url({ protocol: /^https?$/ })
		.max(2048)
		.nullable()
		.meta({
			example:
				'https://www.cs.utexas.edu/~EWD/transcriptions/EWD04xx/EWD498.html'
		})
};

export const CreateSource = z.object({
	...sourceFields,
	author: sourceFields.author.optional(),
	year: sourceFields.year.optional(),
	url: sourceFields.url.optional()
});
export type CreateSource = z.output<typeof CreateSource>;

export const UpdateSource = z
	.object(sourceFields)
	.partial()
	.refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type UpdateSource = z.output<typeof UpdateSource>;

const topicFields = {
	/** Stored lowercase, as displayed: "software design". */
	name: z
		.string()
		.trim()
		.min(1)
		.max(60)
		.transform((name) => name.toLowerCase())
		.meta({ example: 'software design' }),
	slug: slug(60).meta({ example: 'software-design' }),
	description: optionalText(200).meta({
		example: 'How code is shaped, and why.'
	})
};

export const CreateTopic = z.object({
	...topicFields,
	slug: topicFields.slug.optional(),
	description: topicFields.description.optional()
});
export type CreateTopic = z.output<typeof CreateTopic>;

export const UpdateTopic = z
	.object(topicFields)
	.partial()
	.refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type UpdateTopic = z.output<typeof UpdateTopic>;
