import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AppFactory } from '@test/factory/app';
import { HEARTBEAT_KEY, type Heartbeat } from 'common/misc';

describe('Health', () => {
	let app: AppFactory;
	let matching: Queue;

	const beat = async (over: Partial<Heartbeat> = {}) => {
		const body: Heartbeat = {
			at: Date.now(),
			startedAt: Date.now() - 60 * 60_000,
			queues: {},
			...over
		};
		const client = await matching.backend.client;
		await client.set(HEARTBEAT_KEY, JSON.stringify(body), { EX: 60 });
	};

	beforeAll(async () => {
		app = await AppFactory.init();
		matching = app.instance.get<Queue>(getQueueToken('matching'));
	});

	afterEach(async () => {
		const client = await matching.backend.client;
		await client.del(HEARTBEAT_KEY);
		await matching.drain();
	});

	afterAll(async () => {
		await app.close();
	});

	it('/health stays about the API alone', async () => {
		const response = await app.request.get('/health');
		expect(response.status).toBe(200);
		expect(response.body.details).not.toHaveProperty('worker');
	});

	it('/health/queues is 503 without a heartbeat from the worker', async () => {
		const response = await app.request.get('/health/queues');
		expect(response.status).toBe(503);
		expect(JSON.stringify(response.body)).toContain(
			'No heartbeat from the worker'
		);
	});

	it('/health/queues is 200 with a heartbeat and the queues moving', async () => {
		await beat();
		const response = await app.request.get('/health/queues');
		expect(response.status).toBe(200);
		expect(response.body.details).toMatchObject({
			worker: { status: 'up' },
			'queue:matching': { status: 'up' },
			'queue:share-images': { status: 'up' },
			'queue:mail': { status: 'up' }
		});
	});

	it('/health/queues is 503 when a job waits and nothing finishes', async () => {
		await beat({ queues: { matching: { lastFinishedAt: null } } });
		await matching.add(
			'health-probe',
			{},
			{ timestamp: Date.now() - 20 * 60_000 }
		);
		const response = await app.request.get('/health/queues');
		expect(response.status).toBe(503);
		expect(JSON.stringify(response.body)).toContain(
			'A job has waited 20 min and nothing has finished'
		);
	});
});
