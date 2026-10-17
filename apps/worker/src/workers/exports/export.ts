import { once } from 'node:events';
import { createWriteStream, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Prisma, PrismaClient } from '@qotm/db/client';
import type { Storage } from '#lib/storage.js';
import { csvRow } from './csv.js';

/** As the API's AdminQuoteFilters (`apps/api/src/admin/quotes/dto`). */
export interface AdminQuoteFilters {
	q?: string;
	type?: 'canonical' | 'original';
	state?: string;
	/** A selection: exactly these quotes. */
	ids?: string[];
}

/** As the API enqueues it (`apps/api/src/exports/jobs.ts`, ExportQuotesJob). */
export interface ExportQuotesJob {
	filters: AdminQuoteFilters;
	requestedBy: { id: string; handle: string };
}

const PUBLIC_ID = /^q_[0-9a-z]{6}$/;

/**
 * The admin list's filter, as the API builds it
 * (`apps/api/src/admin/quotes/where.ts`, adminQuoteWhere); keep in step.
 * Private quotes are never exported.
 */
export function adminQuoteWhere(f: AdminQuoteFilters): Prisma.QuoteWhereInput {
	const where: Prisma.QuoteWhereInput = {
		type:
			f.type === 'canonical'
				? 'CANONICAL'
				: f.type === 'original'
					? 'ORIGINAL'
					: { not: 'PRIVATE' }
	};
	// A selection: exactly these, whatever else is set.
	if (f.ids) return { ...where, publicId: { in: f.ids } };
	if (f.state)
		where.status = f.state as NonNullable<Prisma.QuoteWhereInput['status']>;
	if (f.q) {
		const text = { contains: f.q, mode: 'insensitive' } as const;
		where.OR = [
			{ text },
			{ attribution: text },
			{ author: { name: text } },
			...(PUBLIC_ID.test(f.q) ? [{ publicId: f.q }] : [])
		];
	}
	return where;
}

export const EXPORT_COLUMNS = [
	'id',
	'text',
	'type',
	'status',
	'author',
	'work',
	'year',
	'source',
	'source_url',
	'contributor',
	'topics',
	'last_release',
	'likes',
	'favorites',
	'created_at',
	'published_at'
];

const exportKey = (prefix: string, jobId: string) => `${prefix}/${jobId}.csv`;

/**
 * Exports the filtered admin quote list as CSV (BUILD-PLAN §6, QOT-52).
 * Rows are read in keyset-paged batches and streamed to a temporary file,
 * which is streamed up to the bucket, so memory stays flat however many
 * rows there are. The file is private: the API serves it to the requesting
 * admin only. A failure throws, so the job is retried, and leaves nothing
 * behind.
 */
export async function exportQuotes(
	db: PrismaClient,
	storage: Storage,
	jobId: string,
	job: ExportQuotesJob,
	options: { prefix: string; batchSize?: number }
) {
	const batchSize = options.batchSize ?? 1000;
	const dir = mkdtempSync(join(tmpdir(), 'qotm-export-'));
	const file = join(dir, 'quotes.csv');
	try {
		const out = createWriteStream(file);
		const write = async (chunk: string) => {
			if (!out.write(chunk)) await once(out, 'drain');
		};
		await write(csvRow(EXPORT_COLUMNS));

		const where = adminQuoteWhere(job.filters);
		let rows = 0;
		let cursor: string | undefined;
		for (;;) {
			const batch = await db.quote.findMany({
				where,
				orderBy: { id: 'asc' },
				take: batchSize,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
				select: {
					id: true,
					publicId: true,
					text: true,
					type: true,
					status: true,
					attribution: true,
					work: true,
					year: true,
					sourceUrl: true,
					likeCount: true,
					favoriteCount: true,
					createdAt: true,
					publishedAt: true,
					author: { select: { name: true } },
					source: { select: { title: true } },
					contributor: { select: { handle: true } },
					topics: { select: { topic: { select: { slug: true } } } }
				}
			});
			if (!batch.length) break;
			const releases = await lastReleases(
				db,
				batch.map((q) => q.id)
			);
			for (const q of batch) {
				await write(
					csvRow([
						q.publicId,
						q.text,
						q.type.toLowerCase(),
						q.status,
						q.author?.name ?? q.attribution,
						q.work,
						q.year,
						q.source?.title,
						q.sourceUrl,
						q.contributor?.handle,
						q.topics.map((t) => t.topic.slug).join(';'),
						releases.get(q.id),
						q.likeCount,
						q.favoriteCount,
						q.createdAt.toISOString(),
						q.publishedAt?.toISOString()
					])
				);
			}
			rows += batch.length;
			cursor = batch[batch.length - 1]!.id;
			if (batch.length < batchSize) break;
		}
		out.end();
		await once(out, 'finish');

		const key = exportKey(options.prefix, jobId);
		await storage.putFile(key, file, {
			contentType: 'text/csv; charset=utf-8'
		});
		return { key, rows, bytes: statSync(file).size };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/** Each quote's newest published release, for one batch. */
async function lastReleases(db: PrismaClient, quoteIds: string[]) {
	const shipped = await db.releaseQuote.findMany({
		where: { quoteId: { in: quoteIds }, release: { state: 'PUBLISHED' } },
		select: {
			quoteId: true,
			release: { select: { version: true, publishedAt: true } }
		}
	});
	const newest = new Map<string, { version: string; at: number }>();
	for (const { quoteId, release } of shipped) {
		const at = release.publishedAt?.getTime() ?? 0;
		if ((newest.get(quoteId)?.at ?? -1) < at) {
			newest.set(quoteId, { version: release.version, at });
		}
	}
	return new Map([...newest].map(([id, r]) => [id, r.version]));
}
