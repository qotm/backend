import { HttpService } from '@nestjs/axios';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Prisma } from '@qotm/db/client';
import {
	QuoteStatus as S,
	QuoteType,
	ReportStatus,
	ReviewKind,
	ReviewOutcome
} from '@qotm/db/enums';
import { firstValueFrom } from 'rxjs';
import { QUEUES } from 'admin/review/services';
import {
	CacheService,
	CustomConfigService,
	LoggerService,
	PrismaService
} from 'common/services';
import { syncCounterKey } from 'dataset/services';
import { CURATED_STATUSES } from 'quotes/visibility';
import { reportRef } from 'review/decisions';
import type {
	DashboardStatsEntity,
	OldestItemsEntity,
	QueueCountsEntity
} from '../entity';

/** The CLI on npm (BUILD-PLAN §9, QOT-14). */
export const NPM_PACKAGE = 'qotm';
export const NPM_DOWNLOADS_URL = `https://api.npmjs.org/downloads/point/last-month/${NPM_PACKAGE}`;

export const COUNTS_KEY = 'admin:stats:counts';
export const ROLLUP_KEY = 'admin:stats:rollup';
export const NPM_KEY = 'admin:stats:npm';
const COUNTS_TTL = 30;
const DAY_MS = 86_400_000;
const PERIOD_DAYS = 30;

type QueueName = keyof typeof QUEUES;
type Rollup = Pick<DashboardStatsEntity, 'quality'> & {
	period: { from: string; to: string; rolledUpAt: string };
	community: Omit<DashboardStatsEntity['community'], 'npmDownloads'>;
};

const share = (part: number, whole: number) =>
	whole ? Math.round((part / whole) * 1000) / 1000 : null;

/**
 * Admin › Dashboard (BUILD-PLAN §8 gaps 8 and 9). Queue sizes are live; the
 * 30-day figures are rolled up on a schedule (and on a miss) into Redis,
 * overwritten each time, so a re-run changes nothing; npm downloads are
 * fetched once a day. The sidebar's counts are cached for 30 seconds.
 */
@Injectable()
export class StatsService implements OnApplicationBootstrap {
	constructor(
		private db: PrismaService,
		private cache: CacheService,
		private http: HttpService,
		private config: CustomConfigService,
		private logger: LoggerService
	) {}

	/** Outside tests, fetch npm downloads at boot if no value is cached yet. */
	onApplicationBootstrap() {
		if (this.config.app.env === 'test') return;
		void this.cache.fetch(NPM_KEY).then((cached) => {
			if (!cached) void this.refreshNpmDownloads();
		});
	}

	async counts(): Promise<QueueCountsEntity> {
		const cached = await this.cache.fetch<QueueCountsEntity>(COUNTS_KEY);
		if (cached) return cached;
		const [verification, curation, submissions, reports] = await Promise.all([
			this.db.quote.count({ where: { OR: QUEUES.verification } }),
			this.db.quote.count({ where: { OR: QUEUES.curation } }),
			this.db.quote.count({ where: { OR: QUEUES.submissions } }),
			this.db.report.count({ where: OPEN_REPORT })
		]);
		const counts = { verification, curation, reports, submissions };
		await this.cache.store(COUNTS_KEY, counts, COUNTS_TTL);
		return counts;
	}

	async stats(): Promise<DashboardStatsEntity> {
		const [rollup, npm, queues] = await Promise.all([
			this.cache
				.fetch<Rollup>(ROLLUP_KEY)
				.then((cached) => cached ?? this.rollUp()),
			this.cache.fetch<{ downloads: number }>(NPM_KEY),
			this.queues()
		]);
		return {
			queues,
			period: {
				from: new Date(rollup.period.from),
				to: new Date(rollup.period.to),
				rolledUpAt: new Date(rollup.period.rolledUpAt)
			},
			quality: rollup.quality,
			community: { ...rollup.community, npmDownloads: npm?.downloads ?? null }
		};
	}

	/** The longest-waiting items across the queues, oldest first. */
	async oldest(limit = 10): Promise<OldestItemsEntity> {
		const quotes = await Promise.all(
			(['verification', 'curation', 'submissions'] as const).map(
				async (queue) =>
					(await this.waiting(queue)).map((q) => ({ ...q, queue }))
			)
		);
		const reports = await this.db.report.findMany({
			where: OPEN_REPORT,
			orderBy: { createdAt: 'asc' },
			take: limit,
			select: { number: true, status: true, createdAt: true }
		});
		const list = [
			...quotes.flat().map((q) => ({
				id: q.publicId,
				queue: q.queue,
				state: q.status,
				waitingSince: q.since
			})),
			...reports.map((r) => ({
				id: reportRef(r.number),
				queue: 'reports' as const,
				state: r.status,
				waitingSince: r.createdAt
			}))
		]
			.sort((a, b) => +a.waitingSince - +b.waitingSince)
			.slice(0, limit);
		return { list };
	}

	/**
	 * The 30-day figures, recomputed from scratch and stored over the last
	 * roll-up: running it twice gives the same result.
	 */
	@Cron(CronExpression.EVERY_HOUR, { name: 'admin-stats-rollup' })
	async rollUp(now = new Date()): Promise<Rollup> {
		const from = new Date(now.getTime() - PERIOD_DAYS * DAY_MS);
		const inPeriod = { gte: from, lt: now };
		const submitted: Prisma.QuoteWhereInput = {
			type: { not: QuoteType.PRIVATE },
			createdAt: inPeriod
		};
		const [
			reviewed,
			verified,
			submissions,
			matched,
			curated,
			useful,
			members,
			registrations,
			contributors,
			syncs
		] = await Promise.all([
			this.db.reviewDecision.count({
				where: { kind: ReviewKind.VERIFICATION, createdAt: inPeriod }
			}),
			this.db.reviewDecision.count({
				where: {
					kind: ReviewKind.VERIFICATION,
					outcome: ReviewOutcome.VERIFY,
					createdAt: inPeriod
				}
			}),
			this.db.quote.count({ where: submitted }),
			this.db.quote.count({
				where: { ...submitted, matches: { some: {} } }
			}),
			this.db.reviewDecision.count({
				where: { outcome: ReviewOutcome.CURATE, createdAt: inPeriod }
			}),
			this.db.quote.count({
				where: {
					...submitted,
					publishedAt: { not: null },
					status: { notIn: [S.WITHDRAWN, S.REJECTED] }
				}
			}),
			this.db.user.count(),
			this.db.user.count({ where: { createdAt: inPeriod } }),
			this.db.quote.findMany({
				where: { ...submitted, contributorId: { not: null } },
				distinct: ['contributorId'],
				select: { contributorId: true }
			}),
			this.syncs(now)
		]);
		const returning = contributors.length
			? await this.db.quote.findMany({
					where: {
						type: { not: QuoteType.PRIVATE },
						createdAt: { lt: from },
						contributorId: {
							in: contributors.map((c) => c.contributorId!)
						}
					},
					distinct: ['contributorId'],
					select: { contributorId: true }
				})
			: [];

		const rollup: Rollup = {
			period: {
				from: from.toISOString(),
				to: now.toISOString(),
				rolledUpAt: new Date().toISOString()
			},
			quality: {
				verificationAcceptance: share(verified, reviewed),
				duplicateRate: share(matched, submissions),
				curated,
				usefulContributionsPer100Users: members
					? Math.round((useful / members) * 1000) / 10
					: null
			},
			community: {
				datasetSyncs: syncs,
				registrations,
				returningContributors: returning.length
			}
		};
		// Kept past the next run, so a failed run still leaves figures to show.
		await this.cache.store(ROLLUP_KEY, rollup, 3 * 3600);
		return rollup;
	}

	/** npm downloads of the CLI over the last month, once a day. */
	@Cron('0 4 * * *', { name: 'admin-stats-npm', timeZone: 'UTC' })
	async refreshNpmDownloads() {
		try {
			const { data } = await firstValueFrom(
				this.http.get<{ downloads: number; start: string; end: string }>(
					NPM_DOWNLOADS_URL
				)
			);
			if (typeof data?.downloads !== 'number') {
				throw new Error('Unexpected npm response');
			}
			const value = {
				downloads: data.downloads,
				start: data.start,
				end: data.end,
				fetchedAt: new Date().toISOString()
			};
			await this.cache.store(NPM_KEY, value, (3 * DAY_MS) / 1000);
			return value;
		} catch (error) {
			this.logger.warn({ error }, 'Could not fetch npm downloads');
			return null;
		}
	}

	/** Each queue: size, when its oldest item last moved, and its card note. */
	private async queues(): Promise<DashboardStatsEntity['queues']> {
		const [verification, curation, submissions, reports] = await Promise.all([
			this.waiting('verification'),
			this.waiting('curation'),
			this.waiting('submissions'),
			this.db.report.findMany({
				where: OPEN_REPORT,
				select: { createdAt: true, quote: { select: { status: true } } },
				orderBy: { createdAt: 'asc' }
			})
		]);
		const oldest = (items: { since: Date }[]) =>
			items.length ? items[0].since : null;
		const where = (s: S) => (q: { status: S }) => q.status === s;
		return {
			verification: {
				count: verification.length,
				oldestSince: oldest(verification),
				needsEvidence: verification.filter(where(S.NEEDS_EVIDENCE)).length
			},
			curation: {
				count: curation.length,
				oldestSince: oldest(curation),
				communityCandidates: curation.filter(where(S.CURATION_CANDIDATE)).length
			},
			reports: {
				count: reports.length,
				oldestSince: reports[0]?.createdAt ?? null,
				onCurated: reports.filter((r) =>
					CURATED_STATUSES.includes(r.quote.status)
				).length
			},
			submissions: {
				count: submissions.length,
				oldestSince: oldest(submissions),
				originalityChecks: submissions.filter(where(S.ORIGINALITY_CHECK)).length
			}
		};
	}

	/** A queue's quotes, longest-waiting first (since their last move). */
	private async waiting(queue: QueueName) {
		const rows = await this.db.quote.findMany({
			where: { OR: QUEUES[queue] },
			select: {
				publicId: true,
				status: true,
				createdAt: true,
				events: { select: { at: true }, orderBy: { at: 'desc' }, take: 1 }
			}
		});
		return rows
			.map((q) => ({
				publicId: q.publicId,
				status: q.status,
				since: q.events[0]?.at ?? q.createdAt
			}))
			.sort((a, b) => +a.since - +b.since);
	}

	/** Manifest requests over the period's days (QOT-37's daily counters). */
	private async syncs(now: Date) {
		const days = await Promise.all(
			Array.from({ length: PERIOD_DAYS }, (_, i) =>
				this.cache.fetch(syncCounterKey(new Date(now.getTime() - i * DAY_MS)))
			)
		);
		return days.reduce((sum: number, day) => sum + (Number(day) || 0), 0);
	}
}

const OPEN_REPORT: Prisma.ReportWhereInput = {
	status: { not: ReportStatus.RESOLVED }
};
