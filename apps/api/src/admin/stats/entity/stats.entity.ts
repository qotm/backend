import { z } from 'zod';
import { dateTime } from 'common/schemas';

const count = (example: number) => z.number().int().meta({ example });
/** A share, 0–1; null when there is nothing to divide by. */
const rate = () => z.number().min(0).max(1).nullable().meta({ example: 0.82 });

/** The admin sidebar's badges: cheap, cached for 30 seconds. */
export const QueueCountsEntity = z
	.object({
		verification: count(12),
		curation: count(7),
		reports: count(3),
		submissions: count(23)
	})
	.meta({ id: 'QueueCountsEntity' });
export type QueueCountsEntity = z.input<typeof QueueCountsEntity>;

const queue = <T extends z.ZodRawShape>(extra: T) =>
	z.object({
		count: count(12),
		/** When the longest-waiting item last moved; null when empty. */
		oldestSince: dateTime().nullable(),
		...extra
	});

/** Admin › Dashboard. */
export const DashboardStatsEntity = z
	.object({
		queues: z.object({
			/** "oldest waiting 6 days" */
			verification: queue({ needsEvidence: count(4) }),
			/** "4 community candidates" */
			curation: queue({ communityCandidates: count(4) }),
			/** "1 on a curated quote" */
			reports: queue({ onCurated: count(1) }),
			/** "9 originality checks" */
			submissions: queue({ originalityChecks: count(9) })
		}),
		/** The 30 days the figures below cover, and when they were rolled up. */
		period: z.object({
			from: dateTime(),
			to: dateTime(),
			rolledUpAt: dateTime()
		}),
		/** Corpus quality · last 30 days. */
		quality: z.object({
			/** Verified ÷ verification decisions. */
			verificationAcceptance: rate(),
			/** Submissions with a possible match ÷ submissions. */
			duplicateRate: rate(),
			curated: count(58),
			/** Submissions that went public, per 100 members. */
			usefulContributionsPer100Users: z
				.number()
				.nullable()
				.meta({ example: 3.4 })
		}),
		/** Community and CLI · last 30 days. */
		community: z.object({
			/** The `qotm` package on npm (fetched daily); null until first fetched. */
			npmDownloads: z.number().int().nullable().meta({ example: 1840 }),
			datasetSyncs: count(5210),
			registrations: count(212),
			/** Members who submitted in the period and also before it. */
			returningContributors: count(31)
		})
	})
	.meta({ id: 'DashboardStatsEntity' });
export type DashboardStatsEntity = z.input<typeof DashboardStatsEntity>;

/** "Oldest in the queues". */
export const OldestItemsEntity = z
	.object({
		list: z.array(
			z.object({
				/** A quote (`q_2x7v3m`) or a report (`r_0412`). */
				id: z.string().meta({ example: 'q_2x7v3m' }),
				queue: z.enum(['verification', 'curation', 'submissions', 'reports']),
				state: z.string().meta({ example: 'NEEDS_EVIDENCE' }),
				waitingSince: dateTime()
			})
		)
	})
	.meta({ id: 'OldestItemsEntity' });
export type OldestItemsEntity = z.input<typeof OldestItemsEntity>;
