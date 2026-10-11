import {
	DeleteObjectCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import { getQueueToken } from '@nestjs/bullmq';
import { Worker, type Queue } from 'bullmq';
import { AppFactory } from '@test/factory/app';
import { SUPER_USER, TEST_ADMIN } from '@test/factory/constants';
import { EXPORTS_QUEUE } from 'exports';

/** Export status and download, with a stand-in for the worker. */
describe('Exports', () => {
	let app: AppFactory;
	let admin: string;
	let other: string;
	let queue: Queue;
	let s3: S3Client;
	const written: string[] = [];

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		admin = (await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password)).cookie!;
		other = (await app.signIn(SUPER_USER.email, SUPER_USER.password)).cookie!;
		queue = app.instance.get(getQueueToken(EXPORTS_QUEUE));
		const { region, endpoint, accessKeyId, secretAccessKey } = app.config.s3;
		s3 = new S3Client({
			region,
			endpoint,
			credentials: { accessKeyId, secretAccessKey },
			forcePathStyle: true
		});
	});

	afterAll(async () => {
		await queue.obliterate({ force: true });
		for (const key of written) {
			await s3.send(
				new DeleteObjectCommand({ Bucket: app.config.s3.bucket, Key: key })
			);
		}
		await app.close();
	});

	const requestExport = async () =>
		(
			await app.request
				.post('/v1/admin/quotes/export')
				.set('Cookie', admin)
				.send({ state: 'CURATED' })
		).body.id as string;
	const status = (id: string, cookie = admin) =>
		app.request.get(`/v1/admin/exports/${id}`).set('Cookie', cookie);
	const download = (id: string, cookie = admin) =>
		app.request.get(`/v1/admin/exports/${id}/download`).set('Cookie', cookie);

	/** Runs the queued jobs as the worker would, with `processor`. */
	async function work(processor: () => Promise<unknown>) {
		const { host, port, username, password } = app.config.redis;
		const worker = new Worker(EXPORTS_QUEUE, processor, {
			connection: { host, port, username, password },
			autorun: false
		});
		const done = new Promise((resolve) => {
			worker.on('completed', resolve);
			worker.on('failed', resolve);
		});
		void worker.run();
		await done;
		await worker.close();
	}

	it('shows the requesting admin a waiting export, and nobody else', async () => {
		const id = await requestExport();
		expect((await status(id)).body).toMatchObject({
			id,
			state: 'waiting',
			rows: null,
			error: null,
			requestedAt: expect.any(String)
		});
		expect((await status(id, other)).status).toBe(404);
		expect((await download(id)).status).toBe(409);
		expect((await status('export-nope')).status).toBe(404);
		await queue.obliterate({ force: true });
	});

	it('serves the finished CSV to the requesting admin only', async () => {
		const id = await requestExport();
		const key = `exports/test-${id}.csv`;
		written.push(key);
		await s3.send(
			new PutObjectCommand({
				Bucket: app.config.s3.bucket,
				Key: key,
				Body: 'id,text\r\nq_8f2k1c,Simplicity.\r\n',
				ContentType: 'text/csv'
			})
		);
		await work(async () => ({ key, rows: 1, bytes: 30 }));

		expect((await status(id)).body).toMatchObject({
			state: 'ready',
			rows: 1,
			bytes: 30
		});
		const res = await download(id);
		expect(res.status).toBe(200);
		expect(res.headers['content-type']).toContain('text/csv');
		expect(res.headers['content-disposition']).toMatch(
			/attachment; filename="qotm-quotes-\d{4}-\d{2}-\d{2}\.csv"/
		);
		expect(res.headers['cache-control']).toBe('private, no-store');
		expect(res.text).toBe('id,text\r\nq_8f2k1c,Simplicity.\r\n');
		expect((await download(id, other)).status).toBe(404);
	});

	it('reports a failed attempt', async () => {
		const id = await requestExport();
		await work(() => Promise.reject(new Error('storage unavailable')));
		expect((await status(id)).body).toMatchObject({
			error: 'storage unavailable'
		});
		expect((await download(id)).status).toBe(409);
	});
});
