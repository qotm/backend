---
name: add-job
description: Add background work to this API with BullMQ — register a queue, produce jobs with retries, and consume them in a processor here or in a separate worker. Use when asked to "do X in the background", "queue this", "don't block the request", "process asynchronously", or when a job must be handed to the node or Python worker.
---

# Add a queue job

The examples are the media queue (`src/media/media.module.ts`,
`src/media/services/media.service.ts`, `src/media/processors/index.ts`) and the
mail queue in `src/common/`.

## 1. Register the queue

In the module that produces: `imports: [QueueModule.register('things')]`
(`QueueModule` from `common/modules`). This also adds it to Bull Board at
`/dashboard`.

## 2. Produce

```ts
constructor(@InjectQueue('things') private readonly queue: Queue) {}

await this.queue.add('rebuild-index', { thingId }, {
	attempts: 5,
	backoff: { type: 'exponential', delay: 10_000 }
});
```

- Job names are kebab-case and say what happens.
- **Set `attempts` and `backoff` here.** The template sets no retry defaults
  (only `removeOnComplete`), so a job without them fails once and stays failed.
- The payload is JSON: ids, not entities. Load fresh data in the consumer.
- Use a stable `jobId` when the same work must not be queued twice.

## 3. Consume, in one of two places

**In this API**, when the work is light and shares the API's code:

```ts
@Injectable()
@Processor('things')
export class ThingsProcessor extends WorkerHost {
	constructor(private readonly logger: LoggerService) { super(); }

	async process(job: Job<{ thingId: string }>) {
		if (job.name === 'rebuild-index') { /* … throw on failure */ }
	}

	@OnWorkerEvent('failed')
	onFailed(job: Job, err: Error) {
		this.logger.error({ err, jobId: job.id, jobName: job.name }, 'Rebuild failed.');
	}
}
```

List it in the module's `providers`. Throw on failure so the retry applies;
make the work safe to run twice.

**In a worker** (`node-worker` / `py-worker`), when it is heavy, long or needs
Python: produce here exactly as above and consume there with its `add-worker`
skill. The queue name and Redis connection must be identical on both sides; a
mismatch fails silently. Do not also register a processor here for the same
queue, or the two compete for jobs.

## 4. Check

Trigger the producer, watch the job on `/dashboard`, and check it completes
(and that a forced failure retries).
