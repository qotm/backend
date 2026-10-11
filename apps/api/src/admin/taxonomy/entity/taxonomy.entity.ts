import { z } from 'zod';
import { SourceKind } from '@qotm/db/enums';
import { paginated } from 'common/entity';

/** Counts as the public pages show them (GET /v1/quotes?…&state=all|curated). */
const counts = {
	quotes: z.number().int().meta({ example: 42 }),
	curated: z.number().int().meta({ example: 31 })
};

export const AdminAuthorEntity = z
	.object({
		id: z.string(),
		name: z.string().meta({ example: 'Edsger W. Dijkstra' }),
		slug: z.string().meta({ example: 'dijkstra' }),
		bornYear: z.number().int().nullable(),
		diedYear: z.number().int().nullable(),
		description: z.string().nullable(),
		/** The table's dates column: "1930–2002", "1942–" or "—". */
		dates: z.string().meta({ example: '1930–2002' }),
		...counts
	})
	.meta({ id: 'AdminAuthorEntity' });
export type AdminAuthorEntity = z.input<typeof AdminAuthorEntity>;
export const PaginatedAdminAuthorEntity = paginated(
	AdminAuthorEntity,
	'PaginatedAdminAuthorEntity'
);
export type PaginatedAdminAuthorEntity = z.input<
	typeof PaginatedAdminAuthorEntity
>;

export const AdminSourceEntity = z
	.object({
		id: z.string(),
		title: z.string(),
		author: z.object({ slug: z.string(), name: z.string() }).nullable(),
		year: z.number().int().nullable(),
		kind: z.enum(SourceKind),
		url: z.string().nullable(),
		/** Public quotes cited from it. */
		quotes: counts.quotes
	})
	.meta({ id: 'AdminSourceEntity' });
export type AdminSourceEntity = z.input<typeof AdminSourceEntity>;
export const PaginatedAdminSourceEntity = paginated(
	AdminSourceEntity,
	'PaginatedAdminSourceEntity'
);
export type PaginatedAdminSourceEntity = z.input<
	typeof PaginatedAdminSourceEntity
>;

export const AdminTopicEntity = z
	.object({
		id: z.string(),
		name: z.string().meta({ example: 'software design' }),
		slug: z.string().meta({ example: 'software-design' }),
		description: z.string().nullable(),
		...counts
	})
	.meta({ id: 'AdminTopicEntity' });
export type AdminTopicEntity = z.input<typeof AdminTopicEntity>;
export const PaginatedAdminTopicEntity = paginated(
	AdminTopicEntity,
	'PaginatedAdminTopicEntity'
);
export type PaginatedAdminTopicEntity = z.input<
	typeof PaginatedAdminTopicEntity
>;
