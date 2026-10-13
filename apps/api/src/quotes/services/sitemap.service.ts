import { Injectable } from '@nestjs/common';
import { PrismaService } from 'common/services';
import type { SitemapEntity } from '../entity';
import { INDEXABLE } from '../visibility';

/** A sitemap file holds at most 50,000 URLs; the web server splits by kind. */
export const SITEMAP_MAX = 50_000;

@Injectable()
export class SitemapService {
	constructor(private db: PrismaService) {}

	/**
	 * Indexable quotes (in the feeds, not under review or disputed), the
	 * authors credited on them and every topic with one. `updatedAt` is the
	 * row's, so a correction moves a quote's `lastmod`.
	 */
	async sitemap(): Promise<SitemapEntity> {
		const [quotes, authors, topics] = await Promise.all([
			this.db.quote.findMany({
				where: INDEXABLE,
				select: { publicId: true, updatedAt: true },
				orderBy: { publishedAt: 'desc' },
				take: SITEMAP_MAX
			}),
			this.db.author.findMany({
				where: { quotes: { some: INDEXABLE } },
				select: { slug: true, updatedAt: true },
				orderBy: { slug: 'asc' },
				take: SITEMAP_MAX
			}),
			this.db.topic.findMany({
				where: { quotes: { some: { quote: INDEXABLE } } },
				select: { slug: true, updatedAt: true },
				orderBy: { slug: 'asc' }
			})
		]);
		return {
			quotes: quotes.map((q) => ({ id: q.publicId, updatedAt: q.updatedAt })),
			authors,
			topics
		};
	}
}
