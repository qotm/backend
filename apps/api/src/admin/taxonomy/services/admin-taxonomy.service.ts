import {
	BadRequestException,
	Injectable,
	NotFoundException
} from '@nestjs/common';
import { Prisma } from '@qotm/db/client';
import { recordAudit, type AuditEntry } from 'audit';
import { PrismaService } from 'common/services';
import { feedWhere } from 'quotes/visibility';
import type {
	CreateAuthor,
	CreateSource,
	CreateTopic,
	TaxonomyFilters,
	UpdateAuthor,
	UpdateSource,
	UpdateTopic
} from '../dto';
import type {
	AdminAuthorEntity,
	AdminSourceEntity,
	AdminTopicEntity,
	PaginatedAdminAuthorEntity,
	PaginatedAdminSourceEntity,
	PaginatedAdminTopicEntity
} from '../entity';

type Actor = NonNullable<AuditEntry['actor']>;

const SOURCE_AUTHOR = {
	author: { select: { slug: true, name: true } }
} satisfies Prisma.SourceInclude;
type SourceRow = Prisma.SourceGetPayload<{ include: typeof SOURCE_AUTHOR }>;

const TX = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted };

/** A slug from a name: "Edsger W. Dijkstra" → "edsger-w-dijkstra". */
export function slugify(name: string, max: number) {
	return name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/[^a-z0-9]+/g, '-')
		.slice(0, max)
		.replace(/^-+|-+$/g, '');
}

/** The admin table's dates column: "1930–2002", "1942–", "–1997" or "—". */
export function lifespanDates(author: {
	bornYear: number | null;
	diedYear: number | null;
}) {
	return author.bornYear || author.diedYear
		? `${author.bornYear ?? ''}–${author.diedYear ?? ''}`
		: '—';
}

/** "name, slug": what an edit changed, for the audit note. */
function changed(body: object) {
	return Object.keys(body).join(', ');
}

function checkYears(author: {
	bornYear: number | null;
	diedYear: number | null;
}) {
	if (author.bornYear && author.diedYear && author.diedYear < author.bornYear) {
		throw new BadRequestException('diedYear is before bornYear');
	}
}

const contains = (search: string) =>
	({ contains: search, mode: 'insensitive' }) as const;

/**
 * Authors, sources and topics for admins (BUILD-PLAN §5: members pick topics,
 * admins add them). Slugs are unique (a clash is a 409), and every write
 * appends its audit row in the same transaction. Nothing is deleted here:
 * quotes and sources hold on to authors, sources and topics (Restrict).
 */
@Injectable()
export class AdminTaxonomyService {
	constructor(private db: PrismaService) {}

	// Authors

	async authors(filters: TaxonomyFilters): Promise<PaginatedAdminAuthorEntity> {
		const where: Prisma.AuthorWhereInput = filters.search
			? {
					OR: [
						{ name: contains(filters.search) },
						{ slug: contains(filters.search) }
					]
				}
			: {};
		const [list, meta] = await this.db.x.author.paginate({
			where,
			orderBy: [{ name: 'asc' }, { id: 'asc' }],
			page: filters.page,
			limit: filters.limit
		});
		const [all, curated] = await Promise.all([
			this.countBy('authorId', list, 'all'),
			this.countBy('authorId', list, 'curated')
		]);
		return {
			list: list.map((a) => this.toAuthor(a, all, curated)),
			...meta
		};
	}

	async createAuthor(body: CreateAuthor, actor: Actor) {
		const data = {
			...body,
			slug: body.slug ?? slugify(body.name, 80),
			bornYear: body.bornYear ?? null,
			diedYear: body.diedYear ?? null
		};
		checkYears(data);
		const author = await this.db.$transaction(async (tx) => {
			const author = await tx.author.create({ data });
			await recordAudit(tx, {
				actor,
				action: 'author.created',
				target: { type: 'author', id: author.slug },
				note: author.name
			});
			return author;
		}, TX);
		return this.author(author.id);
	}

	async updateAuthor(id: string, body: UpdateAuthor, actor: Actor) {
		await this.db.$transaction(async (tx) => {
			const current = await tx.author.findUnique({ where: { id } });
			if (!current) throw new NotFoundException('Author not found');
			checkYears({ ...current, ...body });
			const author = await tx.author.update({ where: { id }, data: body });
			await recordAudit(tx, {
				actor,
				action: 'author.updated',
				target: { type: 'author', id: author.slug },
				note: changed(body)
			});
		}, TX);
		return this.author(id);
	}

	private async author(id: string): Promise<AdminAuthorEntity> {
		const author = await this.db.author.findUniqueOrThrow({ where: { id } });
		const [all, curated] = await Promise.all([
			this.countBy('authorId', [author], 'all'),
			this.countBy('authorId', [author], 'curated')
		]);
		return this.toAuthor(author, all, curated);
	}

	private toAuthor(
		a: Prisma.AuthorGetPayload<object>,
		all: Map<string | null, number>,
		curated: Map<string | null, number>
	): AdminAuthorEntity {
		return {
			id: a.id,
			name: a.name,
			slug: a.slug,
			bornYear: a.bornYear,
			diedYear: a.diedYear,
			description: a.description,
			dates: lifespanDates(a),
			quotes: all.get(a.id) ?? 0,
			curated: curated.get(a.id) ?? 0
		};
	}

	// Sources

	async sources(filters: TaxonomyFilters): Promise<PaginatedAdminSourceEntity> {
		const where: Prisma.SourceWhereInput = filters.search
			? {
					OR: [
						{ title: contains(filters.search) },
						{ author: { name: contains(filters.search) } }
					]
				}
			: {};
		const [list, meta] = await this.db.x.source.paginate({
			where,
			include: SOURCE_AUTHOR,
			orderBy: [{ title: 'asc' }, { id: 'asc' }],
			page: filters.page,
			limit: filters.limit
		});
		const counts = await this.countBy('sourceId', list, 'all');
		return {
			// paginate() does not carry `include` into its row type.
			list: (list as SourceRow[]).map((s) => this.toSource(s, counts)),
			...meta
		};
	}

	async createSource(body: CreateSource, actor: Actor) {
		const authorId = await this.authorIdOf(body.author);
		const source = await this.db.$transaction(async (tx) => {
			const source = await tx.source.create({
				data: {
					title: body.title,
					kind: body.kind,
					year: body.year ?? null,
					url: body.url ?? null,
					authorId: authorId ?? null
				}
			});
			await recordAudit(tx, {
				actor,
				action: 'source.created',
				target: { type: 'source', id: source.id },
				note: source.title
			});
			return source;
		}, TX);
		return this.source(source.id);
	}

	async updateSource(id: string, body: UpdateSource, actor: Actor) {
		const { author, ...rest } = body;
		const authorId = await this.authorIdOf(author);
		await this.db.$transaction(async (tx) => {
			if (!(await tx.source.findUnique({ where: { id } }))) {
				throw new NotFoundException('Source not found');
			}
			await tx.source.update({
				where: { id },
				data: { ...rest, ...(author !== undefined ? { authorId } : {}) }
			});
			await recordAudit(tx, {
				actor,
				action: 'source.updated',
				target: { type: 'source', id },
				note: changed(body)
			});
		}, TX);
		return this.source(id);
	}

	private async source(id: string): Promise<AdminSourceEntity> {
		const source = await this.db.source.findUniqueOrThrow({
			where: { id },
			include: SOURCE_AUTHOR
		});
		return this.toSource(
			source,
			await this.countBy('sourceId', [source], 'all')
		);
	}

	/** An author's id from its slug; undefined stays undefined, null clears. */
	private async authorIdOf(slug: string | null | undefined) {
		if (!slug) return slug;
		const author = await this.db.author.findUnique({
			where: { slug },
			select: { id: true }
		});
		if (!author) throw new BadRequestException(`Unknown author "${slug}"`);
		return author.id;
	}

	private toSource(
		s: SourceRow,
		counts: Map<string | null, number>
	): AdminSourceEntity {
		return {
			id: s.id,
			title: s.title,
			author: s.author,
			year: s.year,
			kind: s.kind,
			url: s.url,
			quotes: counts.get(s.id) ?? 0
		};
	}

	// Topics

	async topics(filters: TaxonomyFilters): Promise<PaginatedAdminTopicEntity> {
		const where: Prisma.TopicWhereInput = filters.search
			? {
					OR: [
						{ name: contains(filters.search) },
						{ slug: contains(filters.search) }
					]
				}
			: {};
		const [list, meta] = await this.db.x.topic.paginate({
			where,
			// The taxonomy's own order, as GET /v1/topics lists it.
			orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
			page: filters.page,
			limit: filters.limit
		});
		const [all, curated] = await Promise.all([
			this.countByTopic(list, 'all'),
			this.countByTopic(list, 'curated')
		]);
		return {
			list: list.map((t) => this.toTopic(t, all, curated)),
			...meta
		};
	}

	async createTopic(body: CreateTopic, actor: Actor) {
		const topic = await this.db.$transaction(async (tx) => {
			const topic = await tx.topic.create({
				data: {
					name: body.name,
					slug: body.slug ?? slugify(body.name, 60),
					description: body.description ?? null
				}
			});
			await recordAudit(tx, {
				actor,
				action: 'topic.created',
				target: { type: 'topic', id: topic.slug },
				note: topic.name
			});
			return topic;
		}, TX);
		return this.topic(topic.id);
	}

	async updateTopic(id: string, body: UpdateTopic, actor: Actor) {
		await this.db.$transaction(async (tx) => {
			if (!(await tx.topic.findUnique({ where: { id } }))) {
				throw new NotFoundException('Topic not found');
			}
			const topic = await tx.topic.update({ where: { id }, data: body });
			await recordAudit(tx, {
				actor,
				action: 'topic.updated',
				target: { type: 'topic', id: topic.slug },
				note: changed(body)
			});
		}, TX);
		return this.topic(id);
	}

	private async topic(id: string): Promise<AdminTopicEntity> {
		const topic = await this.db.topic.findUniqueOrThrow({ where: { id } });
		const [all, curated] = await Promise.all([
			this.countByTopic([topic], 'all'),
			this.countByTopic([topic], 'curated')
		]);
		return this.toTopic(topic, all, curated);
	}

	private toTopic(
		t: Prisma.TopicGetPayload<object>,
		all: Map<string, number>,
		curated: Map<string, number>
	): AdminTopicEntity {
		return {
			id: t.id,
			name: t.name,
			slug: t.slug,
			description: t.description,
			quotes: all.get(t.id) ?? 0,
			curated: curated.get(t.id) ?? 0
		};
	}

	// Counts

	/** Public quotes per author or source, as the public pages count them. */
	private async countBy(
		by: 'authorId' | 'sourceId',
		rows: { id: string }[],
		state: 'all' | 'curated'
	) {
		if (!rows.length) return new Map<string | null, number>();
		const groups = await this.db.quote.groupBy({
			by: [by],
			where: { ...feedWhere(state), [by]: { in: rows.map((r) => r.id) } },
			_count: { _all: true }
		});
		return new Map(groups.map((g) => [g[by], g._count._all]));
	}

	private async countByTopic(rows: { id: string }[], state: 'all' | 'curated') {
		if (!rows.length) return new Map<string, number>();
		const groups = await this.db.quoteTopic.groupBy({
			by: ['topicId'],
			where: {
				topicId: { in: rows.map((r) => r.id) },
				quote: feedWhere(state)
			},
			_count: { _all: true }
		});
		return new Map(groups.map((g) => [g.topicId, g._count._all]));
	}
}
