import logger from '#app/logger.js';
import * as Workers from '#app/workers/index.js';

// Everything still running when a shutdown starts: each entry settles once its
// worker has stopped taking new work and finished what it had.
const running: Promise<unknown>[] = [];

logger.info('Worker started');

// Add each new BullMQ worker to this list: it is started here and closed on
// shutdown (close() stops fetching and waits for the active job).
const queueWorkers = [Workers.example, Workers.matching, Workers.releases];
for (const worker of queueWorkers) void worker.run();

let stopping = false;
const shutdown = (signal: NodeJS.Signals) => {
	// `on` rather than `once`, and idempotent: the telemetry preload re-raises
	// the signal after flushing, and that second delivery must not kill the
	// process while jobs are still finishing.
	if (stopping) return;
	stopping = true;
	logger.info({ signal }, 'Shutting down');
	void Promise.allSettled([
		...queueWorkers.map((worker) => worker.close()),
		...running
	]).then(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
