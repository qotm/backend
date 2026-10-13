import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'common/services';
import { feedWhere } from 'quotes/visibility';
import type { AuthorEntity, TopicEntity, TopicListEntity } from '../entity';

const AUTHOR_TOPICS = 4;

/** "1930–2002 · computer scientist", "1942–", or "—" (AuthorHeader's line). */
export function lifespanLine(author: {
	bornYear: number | null;
	diedYear: number | null;
	description: string | null;
}) {
	const years =
		author.bornYear || author.diedYear
			? `${author.bornYear ?? ''}–${author.diedYear ?? ''}`
			: '';
	return [years, author.description].filter(Boolean).join(' · ') || '—';
}

@Injectable()
export class TaxonomyService {
	constructor(private db: PrismaService) {}

	/** Every topic, in the taxonomy's order, with its feed counts. */
	async topics(): Promise<TopicListEntity> {
		const [topics, all, curated] = await Promise.all([
			this.db.topic.findMany({
				orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
			}),
			this.countByTopic('all'),
			this.countByTopic('curated')
		]);
		return {
			list: topics.map((t) => ({
				slug: t.slug,
				name: t.name,
				description: t.description,
				counts: { quotes: all.get(t.id) ?? 0, curated: curated.get(t.id) ?? 0 }
			}))
		};
	}

	async topic(slug: string): Promise<TopicEntity> {
		const topic = await this.db.topic.findUnique({ where: { slug } });
		if (!topic) throw new NotFoundException('Topic not found');
		const count = (state: 'all' | 'curated') =>
			this.db.quote.count({
				where: { ...feedWhere(state), topics: { some: { topicId: topic.id } } }
			});
		const [quotes, curated] = await Promise.all([
			count('all'),
			count('curated')
		]);
		return {
			slug: topic.slug,
			name: topic.name,
			description: topic.description,
			counts: { quotes, curated }
		};
	}

	async author(slug: string): Promise<AuthorEntity> {
		const author = await this.db.author.findUnique({ where: { slug } });
		if (!author) throw new NotFoundException('Author not found');
		const count = (state: 'all' | 'curated' | 'review') =>
			this.db.quote.count({
				where: { ...feedWhere(state), authorId: author.id }
			});
		const [all, curated, review, topicCounts] = await Promise.all([
			count('all'),
			count('curated'),
			count('review'),
			this.db.quoteTopic.groupBy({
				by: ['topicId'],
				where: { quote: { ...feedWhere('all'), authorId: author.id } },
				_count: { _all: true },
				orderBy: { _count: { topicId: 'desc' } },
				take: AUTHOR_TOPICS
			})
		]);
		const topics = await this.db.topic.findMany({
			where: { id: { in: topicCounts.map((t) => t.topicId) } },
			select: { id: true, slug: true, name: true }
		});
		const byId = new Map(topics.map((t) => [t.id, t]));
		return {
			slug: author.slug,
			name: author.name,
			bornYear: author.bornYear,
			diedYear: author.diedYear,
			description: author.description,
			wikidataId: author.wikidataId,
			line: lifespanLine(author),
			topics: topicCounts.flatMap((t) => {
				const topic = byId.get(t.topicId);
				return topic ? [{ slug: topic.slug, name: topic.name }] : [];
			}),
			tabs: { all, curated, review }
		};
	}

	private async countByTopic(state: 'all' | 'curated') {
		const rows = await this.db.quoteTopic.groupBy({
			by: ['topicId'],
			where: { quote: feedWhere(state) },
			_count: { _all: true }
		});
		return new Map(rows.map((r) => [r.topicId, r._count._all]));
	}
}
