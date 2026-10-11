import {
	DeleteObjectCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AppFactory } from '@test/factory/app';
import { TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import {
	RENDER_SHARE_IMAGE,
	SHARE_IMAGES_QUEUE,
	shareCardOf,
	shareKey,
	shareRevision
} from 'share';

/** Share images and og:images, against the real test stack and bucket. */
describe('Share images', () => {
	let app: AppFactory;
	let queue: Queue;
	let s3: S3Client;
	const written: string[] = [];

	let n = 0;
	async function quote(
		status: 'CURATED' | 'PRIVATE' | 'SUBMITTED' | 'WITHDRAWN' = 'CURATED',
		text = `A shareable thought ${n + 1}.`
	) {
		const author = await app.db.author.upsert({
			where: { slug: 'dijkstra' },
			update: {},
			create: { slug: 'dijkstra', name: 'Edsger W. Dijkstra' }
		});
		return app.db.quote.create({
			data: {
				publicId: `q_sh${String(++n).padStart(4, '0')}`,
				text,
				type: status === 'PRIVATE' ? 'PRIVATE' : 'CANONICAL',
				status,
				authorId: author.id,
				publishedAt: new Date()
			},
			include: { author: true, contributor: true }
		});
	}
	type Row = Awaited<ReturnType<typeof quote>>;
	const keyOf = (row: Row, variant: 'quote' | 'terminal' = 'quote') =>
		shareKey(row.publicId, variant, shareRevision(shareCardOf(row), variant));

	/** Stands in for the worker: puts a PNG where the render would. */
	async function rendered(key: string) {
		written.push(key);
		await s3.send(
			new PutObjectCommand({
				Bucket: app.config.s3.bucket,
				Key: key,
				Body: Buffer.from('png'),
				ContentType: 'image/png'
			})
		);
	}

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		queue = app.instance.get(getQueueToken(SHARE_IMAGES_QUEUE));
		const { region, endpoint, accessKeyId, secretAccessKey } = app.config.s3;
		s3 = new S3Client({
			region,
			endpoint,
			credentials: { accessKeyId, secretAccessKey },
			forcePathStyle: true
		});
	});

	afterEach(async () => {
		await queue.obliterate({ force: true });
	});

	afterAll(async () => {
		for (const key of written) {
			await s3.send(
				new DeleteObjectCommand({ Bucket: app.config.s3.bucket, Key: key })
			);
		}
		await app.close();
	});

	const get = (path: string) => app.request.get(path).redirects(0);

	it('serves a placeholder and queues one render until the image exists', async () => {
		const row = await quote();
		const res = await get(`/v1/quotes/${row.publicId}/og.png`);
		expect(res.status).toBe(200);
		expect(res.headers['content-type']).toBe('image/png');
		expect(res.headers['cache-control']).toBe('no-store');
		expect(res.body.subarray(1, 4).toString()).toBe('PNG');

		await get(`/v1/quotes/${row.publicId}/share-image`); // same image
		const jobs = await queue.getJobs(['waiting']);
		expect(jobs).toHaveLength(1);
		expect(jobs[0]).toMatchObject({
			name: RENDER_SHARE_IMAGE,
			data: {
				key: keyOf(row),
				variant: 'quote',
				card: {
					id: row.publicId,
					text: row.text,
					author: 'Edsger W. Dijkstra'
				}
			},
			opts: { attempts: 3, backoff: { type: 'exponential', delay: 15_000 } }
		});
	});

	it('renders each variant separately', async () => {
		const row = await quote();
		await get(`/v1/quotes/${row.publicId}/share-image?variant=terminal`);
		const [job] = await queue.getJobs(['waiting']);
		expect(job!.data).toMatchObject({
			key: keyOf(row, 'terminal'),
			variant: 'terminal'
		});
		expect(
			(await get(`/v1/quotes/${row.publicId}/share-image?variant=poster`))
				.status
		).toBe(400);
	});

	it('redirects to the rendered image, keyed by revision', async () => {
		const row = await quote();
		await rendered(keyOf(row));
		const res = await get(`/v1/quotes/${row.publicId}/og.png`);
		expect(res.status).toBe(302);
		expect(res.headers.location).toBe(
			`${app.config.s3.endpoint}/${app.config.s3.bucket}/${keyOf(row)}`
		);
		expect(res.headers['cache-control']).toBe('public, max-age=300');
		expect(res.headers.etag).toBe(
			`"${shareRevision(shareCardOf(row), 'quote')}"`
		);
		expect(await queue.count()).toBe(0);
	});

	it('never draws a quote that is not public', async () => {
		const owner = await app.db.user.findUniqueOrThrow({
			where: { email: TEST_USER.email }
		});
		for (const status of ['PRIVATE', 'SUBMITTED', 'WITHDRAWN'] as const) {
			const row = await quote(status);
			await app.db.quote.update({
				where: { id: row.id },
				data: { contributorId: owner.id }
			});
			const cookie = (await app.signIn(TEST_USER.email, TEST_USER.password))
				.cookie!;
			const res = await get(`/v1/quotes/${row.publicId}/og.png`).set(
				'Cookie',
				cookie
			);
			expect(res.status).toBe(404);
		}
		expect((await get('/v1/quotes/q_zzzzzz/og.png')).status).toBe(404);
		expect(await queue.count()).toBe(0);
	});

	it('a wording correction is a new revision, queued for both variants', async () => {
		const row = await quote(
			'CURATED',
			'Simplicity is prerequisit for reliability.'
		);
		await rendered(keyOf(row));
		const admin = (await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password))
			.cookie!;
		const res = await app.request
			.patch(`/v1/admin/quotes/${row.publicId}`)
			.set('Cookie', admin)
			.send({
				text: 'Simplicity is prerequisite for reliability.',
				note: 'Typo in prerequisite'
			});
		expect(res.status).toBe(200);

		const corrected = await app.db.quote.findUniqueOrThrow({
			where: { id: row.id },
			include: { author: true, contributor: true }
		});
		expect(keyOf(corrected)).not.toBe(keyOf(row));
		const keys = (await queue.getJobs(['waiting']))
			.map((j) => j.data.key)
			.sort();
		expect(keys).toEqual(
			[keyOf(corrected), keyOf(corrected, 'terminal')].sort()
		);
		// The old revision's redirect is gone: the page now asks for the new one.
		expect((await get(`/v1/quotes/${row.publicId}/og.png`)).status).toBe(200);
	});
});
