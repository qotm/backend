import type { PrismaClient } from '@qotm/db/client';
import type { Dataset } from './write.js';

/**
 * Quotes a release ships: curated, or already shipped and since neither
 * withdrawn nor disputed. The same set as the API's RELEASE_ELIGIBLE
 * (`apps/api/src/releases/releases.ts`); keep the two in step. Private quotes
 * never reach these statuses, and are excluded by type as well.
 */
export const ELIGIBLE_STATUSES = ['CURATED', 'DATASET_RELEASE'] as const;

type Db = Pick<PrismaClient, 'quote'>;

/**
 * Reads the eligible quotes and what they reference, selecting only the
 * columns the dataset holds: no ids, emails or other account data leave the
 * database.
 */
export async function loadDataset(
	db: Db,
	version: string,
	builtAt = new Date()
): Promise<Dataset> {
	const rows = await db.quote.findMany({
		where: {
			status: { in: [...ELIGIBLE_STATUSES] },
			type: { in: ['CANONICAL', 'ORIGINAL'] }
		},
		select: {
			publicId: true,
			text: true,
			type: true,
			work: true,
			year: true,
			sourceUrl: true,
			author: {
				select: {
					slug: true,
					name: true,
					bornYear: true,
					diedYear: true,
					description: true
				}
			},
			source: { select: { title: true, url: true } },
			contributor: { select: { handle: true } },
			topics: { select: { topic: { select: { slug: true, name: true } } } }
		},
		orderBy: { publicId: 'asc' }
	});

	const authors = new Map<string, Dataset['authors'][number]>();
	const topics = new Map<string, Dataset['topics'][number]>();
	const quotes = rows.map((row) => {
		if (row.author) authors.set(row.author.slug, row.author);
		for (const { topic } of row.topics) topics.set(topic.slug, topic);
		return {
			id: row.publicId,
			text: row.text,
			type:
				row.type === 'ORIGINAL'
					? ('original' as const)
					: ('canonical' as const),
			author: row.author?.slug ?? null,
			work: row.work,
			year: row.year,
			source: row.source?.title ?? null,
			sourceUrl: row.sourceUrl ?? row.source?.url ?? null,
			contributor: row.contributor?.handle ?? null,
			topics: row.topics.map((t) => t.topic.slug)
		};
	});
	return {
		version,
		builtAt,
		authors: [...authors.values()],
		topics: [...topics.values()],
		quotes
	};
}
