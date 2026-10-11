import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AppFactory } from '@test/factory/app';
import {
	BUILD_PREVIEW,
	PUBLISH_RELEASE,
	RELEASES_QUEUE,
	ReleaseJobs
} from 'releases';

/** The `releases` producer, against the test Redis (no worker consumes it). */
describe('Release jobs', () => {
	let app: AppFactory;
	let jobs: ReleaseJobs;
	let queue: Queue;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		jobs = app.instance.get(ReleaseJobs);
		queue = app.instance.get(getQueueToken(RELEASES_QUEUE));
	});

	afterEach(async () => {
		await queue.obliterate({ force: true });
	});

	afterAll(async () => {
		await app.close();
	});

	const actor = { id: 'u1', handle: 'mireille' };

	it('queues a build with retries and backoff, for the worker’s queue name', async () => {
		expect(RELEASES_QUEUE).toBe('releases');
		expect(await jobs.preview({ releaseId: 'r1', actor })).toBe(true);
		const [job] = await queue.getJobs(['waiting']);
		expect(job).toMatchObject({
			name: BUILD_PREVIEW,
			data: { releaseId: 'r1', actor },
			opts: {
				attempts: 3,
				backoff: { type: 'exponential', delay: 30_000 }
			}
		});
		expect(await jobs.building()).toBe(true);
	});

	it('keeps one build in flight at a time', async () => {
		expect(await jobs.preview({ releaseId: 'r1', actor })).toBe(true);
		expect(await jobs.preview({ releaseId: 'r2', actor })).toBe(false);
		expect(await queue.getJobCounts('waiting')).toEqual({ waiting: 1 });
	});

	it('takes a new build once the last one is gone', async () => {
		await jobs.preview({ releaseId: 'r1', actor });
		const [job] = await queue.getJobs(['waiting']);
		await job!.remove();
		expect(await jobs.building()).toBe(false);
		expect(await jobs.preview({ releaseId: 'r1', actor })).toBe(true);
	});

	it('queues a publish with retries, once per release', async () => {
		expect(await jobs.publish({ releaseId: 'r1', actor })).toBe(true);
		expect(await jobs.publish({ releaseId: 'r1', actor })).toBe(false);
		expect(await jobs.publish({ releaseId: 'r2', actor })).toBe(true);
		const [job] = await queue.getJobs(['waiting']);
		expect(job).toMatchObject({
			name: PUBLISH_RELEASE,
			opts: { attempts: 5, backoff: { type: 'exponential', delay: 10_000 } }
		});
	});
});
