import type { Worker } from 'bullmq';
import logger from '#app/logger.js';

/**
 * Where this process says it is alive and working, for the API's
 * /health/queues (apps/api/src/common/misc/queues.indicator.ts reads it: keep
 * the key and shape in step). It expires unless renewed, so a worker that
 * stops, hangs or loses Redis drops out of it on its own.
 */
export const HEARTBEAT_KEY = 'qotm:worker:heartbeat';
export const HEARTBEAT_EVERY_MS = 15_000;
const HEARTBEAT_TTL_SECONDS = 60;

export type Heartbeat = {
	/** When this beat was written (ms). */
	at: number;
	/** When this process started consuming (ms). */
	startedAt: number;
	/** Per queue, when this process last finished a job, done or failed (ms). */
	queues: Record<string, { lastFinishedAt: number | null }>;
};

/** Notes each job the workers finish and writes a heartbeat every HEARTBEAT_EVERY_MS. */
export function startHeartbeat(
	workers: Worker[],
	now: () => number = Date.now
) {
	const startedAt = now();
	const queues: Heartbeat['queues'] = {};
	for (const worker of workers) {
		queues[worker.name] = { lastFinishedAt: null };
		const finished = () => (queues[worker.name] = { lastFinishedAt: now() });
		worker.on('completed', finished);
		worker.on('failed', finished);
	}

	const beat = async () => {
		const body: Heartbeat = { at: now(), startedAt, queues };
		// The first worker's own connection: no client of our own to open or close.
		const client = await workers[0]!.backend.client;
		await client.set(HEARTBEAT_KEY, JSON.stringify(body), {
			EX: HEARTBEAT_TTL_SECONDS
		});
	};
	const tick = () =>
		void beat().catch((err) => logger.warn({ err }, 'Heartbeat not written'));
	tick();
	const timer = setInterval(tick, HEARTBEAT_EVERY_MS);
	timer.unref();
	// Left to expire on shutdown, so a deploy's restart is not an outage.
	return { stop: () => clearInterval(timer) };
}
