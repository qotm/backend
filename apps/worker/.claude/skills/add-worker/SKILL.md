---
name: add-worker
description: Add a BullMQ queue consumer to this worker for a job the API produces — the queue name, a typed handler, registration and shutdown. Use when asked to "process X in the worker", "consume the Y queue", "add a job handler", or when the API gains a QueueModule.register('<name>') this worker should run.
---

# Add a queue consumer

The example consumer is `src/workers/example/index.ts`; copy its shape.

1. **Name the queue** in `src/workers/constants.ts`:
   `export const REPORTS_QUEUE = 'reports';`
   It must be exactly the name the API registers (`QueueModule.register('reports')`).
   Check the API side before choosing it; a mismatch is silent.

2. **Write the handler** in `src/workers/<name>/index.ts`:

   ```ts
   import type { Job } from 'bullmq';
   import logger from '#app/logger.js';
   import { createWorker } from '#utils/worker.js';
   import { REPORTS_QUEUE } from '#app/workers/constants.js';

   type ReportsJob = { accountId: string };

   export const reports = createWorker<ReportsJob>(
   	REPORTS_QUEUE,
   	async (job: Job<ReportsJob>) => {
   		logger.info(
   			{ jobId: job.id, accountId: job.data.accountId },
   			'Building report'
   		);
   		// …the work; throw on a genuine failure so BullMQ retries it
   		await job.updateProgress(100);
   		return { ok: true };
   	}
   );
   ```

   - Type the payload to match what the API enqueues; share the type by copy,
     and say in a comment where the producer lives.
   - Use `DB.instance` from `#app/db.js` for data. It is the shared
     `@qotm/db` client, so every model the API has exists here. If the job
     needs a table that does not exist yet, add it through the API's
     `add-model` (the API owns migrations), not from the worker.
   - Throw rather than return on failure. Retries and backoff are the
     producer's options (`attempts`, `backoff` on `queue.add`), not the
     worker's.
   - Make the handler safe to run twice: a retry re-runs it from the top.
   - `createWorker` fixes `concurrency: 1` and does not accept an override. If
     a queue genuinely needs parallelism, change the helper deliberately and
     say so.

3. **Register it**: re-export from `src/workers/index.ts`
   (`export * from './reports/index.js';`) and add it to `queueWorkers` in
   `src/index.ts`. That list is what starts it and what closes it on shutdown;
   a worker missing from it never runs.

4. **Check**: `yarn typecheck && yarn lint`, then run `yarn dev` against the
   API's Redis and enqueue a job from the API to see it processed.
