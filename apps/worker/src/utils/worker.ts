import { Worker, type Job, type WorkerOptions, type Processor } from 'bullmq';
import type { EventEmitter } from 'node:events';
import { BullMQOtel } from 'bullmq-otel';
import config from '#app/config.js';
import logger from '#app/logger.js';

export const createWorker = <
	DataType = unknown,
	ResultType = unknown,
	NameType extends string = string
>(
	name: string,
	processor: Processor<DataType, ResultType, NameType>,
	opts?: Omit<WorkerOptions, 'connection' | 'concurrency' | 'autorun'>
) => {
	const connection = {
		host: config.redis.host,
		port: config.redis.port,
		username: config.redis.user,
		password: config.redis.password
	};

	const defaultOptions = {
		concurrency: 1,
		autorun: false,
		// Job spans and metrics; a no-op unless the OpenTelemetry SDK is running
		// (see src/instrumentation.ts).
		telemetry: new BullMQOtel({
			tracerName: 'qotm-worker',
			meterName: 'qotm-worker',
			enableMetrics: true
		})
	};

	const options = !opts
		? { connection, ...defaultOptions }
		: { connection, ...defaultOptions, ...opts };
	return logFailures(new Worker(name, processor, options));
};

/**
 * A job's last failed attempt is an error (OpenObserve's worker_errors alert
 * counts them); one BullMQ will retry is a warning. A worker's own error, a
 * lost Redis connection say, is an error too.
 */
export function logFailures<W extends EventEmitter & { name: string }>(
	worker: W
): W {
	worker.on('failed', (job: Job | undefined, err: Error) => {
		const attempts = job?.opts.attempts ?? 1;
		const final = !job || job.attemptsMade >= attempts;
		const fields = {
			queue: worker.name,
			jobId: job?.id,
			jobName: job?.name,
			attempt: job?.attemptsMade,
			attempts,
			err
		};
		if (final) logger.error(fields, 'Job failed');
		else logger.warn(fields, 'Job attempt failed; it will be retried');
	});
	worker.on('error', (err: Error) =>
		logger.error({ queue: worker.name, err }, 'Worker error')
	);
	return worker;
}
