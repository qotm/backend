import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import {
	HealthIndicatorResult,
	HealthIndicatorService
} from '@nestjs/terminus';
import type { Job, Queue } from 'bullmq';

/**
 * The worker's heartbeat: apps/worker/src/utils/heartbeat.ts writes it every
 * 15s with a 60s expiry. Keep the key and shape in step.
 */
export const HEARTBEAT_KEY = 'qotm:worker:heartbeat';
export type Heartbeat = {
	at: number;
	startedAt: number;
	queues: Record<string, { lastFinishedAt: number | null }>;
};

/** A job next in line this long, with nothing finished meanwhile, means its consumer has stopped. */
export const STALL_MS = 10 * 60_000;

/**
 * The queues the worker consumes, named as their producers name them
 * (submissions.service MATCHING_QUEUE, releases/jobs, share/jobs,
 * exports/jobs), and those this API consumes itself (MailProcessor,
 * MediaProcessor).
 */
export const WORKER_QUEUES = [
	'matching',
	'releases',
	'share-images',
	'exports'
] as const;
export const API_QUEUES = ['mail', 'media'] as const;
type QueueName = (typeof WORKER_QUEUES)[number] | (typeof API_QUEUES)[number];

/**
 * Why a queue has stopped, or null. It has when its next job has been ready
 * for STALL_MS and its consumer has finished nothing in that time
 * (`progressSince`, null when unknown). A long backlog that moves is not a
 * stall: the hourly og:image backfill makes one.
 */
export function stallReason(
	nextReadyAt: number | null,
	progressSince: number | null,
	now: number
): string | null {
	if (nextReadyAt === null || now - nextReadyAt < STALL_MS) return null;
	if (progressSince !== null && now - progressSince < STALL_MS) return null;
	const minutes = Math.floor((now - nextReadyAt) / 60_000);
	return `A job has waited ${minutes} min and nothing has finished`;
}

/** When a job became ready to run: added, plus any delay it was given. */
const readyAt = (job: Job) => job.timestamp + (job.delay ?? 0);

/**
 * /health/queues: whether the worker is alive and every queue is being
 * consumed. Kept apart from /health, which the API's own container check
 * probes: a stopped worker must not take the API down with it.
 */
@Injectable()
export class QueuesHealthIndicator {
	private readonly queues: Record<QueueName, Queue>;

	constructor(
		private readonly indicators: HealthIndicatorService,
		@InjectQueue('matching') matching: Queue,
		@InjectQueue('releases') releases: Queue,
		@InjectQueue('share-images') shareImages: Queue,
		@InjectQueue('exports') exports: Queue,
		@InjectQueue('mail') mail: Queue,
		@InjectQueue('media') media: Queue
	) {
		this.queues = {
			matching,
			releases,
			'share-images': shareImages,
			exports,
			mail,
			media
		};
	}

	/** One check for the worker, then one per queue, sharing one read of the heartbeat. */
	checks(now = Date.now()): (() => Promise<HealthIndicatorResult>)[] {
		const beat = this.heartbeat();
		// Each check reports its own failure; this keeps an unread rejection quiet.
		beat.catch(() => undefined);
		return [
			() => this.worker(beat, now),
			...WORKER_QUEUES.map((name) => () => this.queue(name, beat, now)),
			...API_QUEUES.map((name) => () => this.queue(name, null, now))
		];
	}

	private async heartbeat(): Promise<Heartbeat | null> {
		const client = await this.queues.matching.backend.client;
		const raw = await client.get(HEARTBEAT_KEY);
		return raw ? (JSON.parse(raw) as Heartbeat) : null;
	}

	private async worker(beat: Promise<Heartbeat | null>, now: number) {
		const indicator = this.indicators.check('worker');
		let heartbeat: Heartbeat | null;
		try {
			heartbeat = await beat;
		} catch {
			return indicator.down({ message: 'Redis unreachable' });
		}
		if (!heartbeat) {
			return indicator.down({ message: 'No heartbeat from the worker' });
		}
		return indicator.up({
			lastBeatSecondsAgo: Math.round((now - heartbeat.at) / 1000),
			upSince: new Date(heartbeat.startedAt).toISOString()
		});
	}

	/** `beat` is null for a queue this API consumes: no heartbeat speaks for it. */
	private async queue(
		name: QueueName,
		beat: Promise<Heartbeat | null> | null,
		now: number
	) {
		const indicator = this.indicators.check(`queue:${name}`);
		const queue = this.queues[name];
		try {
			const [counts, waiting, prioritized] = await Promise.all([
				queue.getJobCounts(
					'waiting',
					'prioritized',
					'active',
					'delayed',
					'failed'
				),
				queue.getJobs('wait', 0, 9, true),
				queue.getJobs('prioritized', 0, 9, true)
			]);
			const next = [...waiting, ...prioritized].filter(Boolean).map(readyAt);
			const nextReadyAt = next.length ? Math.min(...next) : null;
			const heartbeat = beat ? await beat.catch(() => null) : null;
			const progressSince = heartbeat
				? Math.max(
						heartbeat.startedAt,
						heartbeat.queues[name]?.lastFinishedAt ?? 0
					)
				: null;
			const details = {
				waiting: (counts.waiting ?? 0) + (counts.prioritized ?? 0),
				active: counts.active ?? 0,
				delayed: counts.delayed ?? 0,
				failed: counts.failed ?? 0,
				nextWaitingSeconds:
					nextReadyAt === null
						? null
						: Math.max(0, Math.round((now - nextReadyAt) / 1000))
			};
			const stalled = stallReason(nextReadyAt, progressSince, now);
			return stalled
				? indicator.down({ ...details, message: stalled })
				: indicator.up(details);
		} catch {
			return indicator.down({ message: 'Redis unreachable' });
		}
	}
}
