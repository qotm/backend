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
	FALLBACK_PNG,
	RENDER_SHARE_IMAGE,
	SHARE_IMAGES_QUEUE,
	SITE_CARD,
	ShareImagesService,
	pageKey,
	pageRevision,
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
				Body: Buffer.from(`png:${key}`),
				ContentType: 'image/png'
			})
		);
	}

	const siteKey = pageKey(SITE_CARD, pageRevision(SITE_CARD));
	/** Every queued render, prioritised (drawn ahead) or not. */
	const queued = () => queue.getJobs(['waiting', 'prioritized']);

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		queue = app.instance.get(getQueueToken(SHARE_IMAGES_QUEUE));
		// og:images wait up to 8s for a render; a few hundred ms is enough here.
		const service = app.instance.get(ShareImagesService);
		const og = service.og.bind(service);
		vi.spyOn(service, 'og').mockImplementation((target) => og(target, 600));
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

	it('serves the Share dialog a placeholder and queues one render until the image exists', async () => {
		const row = await quote();
		const res = await get(`/v1/quotes/${row.publicId}/share-image`);
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

	it('never gives an unfurler the placeholder: the bundled card while nothing is drawn', async () => {
		// The bucket is shared: another suite's worker may have drawn the site card.
		await s3.send(
			new DeleteObjectCommand({ Bucket: app.config.s3.bucket, Key: siteKey })
		);
		const row = await quote();
		const res = await get(`/v1/quotes/${row.publicId}/og.png`);
		expect(res.status).toBe(200);
		expect(res.headers['x-og-image']).toBe('fallback');
		expect(res.headers['cache-control']).toBe('no-store');
		expect(Buffer.compare(res.body, FALLBACK_PNG)).toBe(0);
		// The quote's card and the site card are both on their way.
		const keys = (await queued()).map((j) => j.data.key).sort();
		expect(keys).toEqual([keyOf(row), siteKey].sort());
	});

	it('falls back to the rendered site card', async () => {
		const row = await quote();
		await rendered(siteKey);
		const res = await get(`/v1/quotes/${row.publicId}/og.png`);
		expect(res.status).toBe(200);
		expect(res.headers['x-og-image']).toBe('fallback');
		expect(res.headers['cache-control']).toBe('no-store');
		expect(res.body.toString()).toBe(`png:${siteKey}`);
	});

	it('waits for a render that lands while the unfurler waits', async () => {
		const row = await quote();
		const pending = get(`/v1/quotes/${row.publicId}/og.png`).then((r) => r);
		await new Promise((r) => setTimeout(r, 150));
		await rendered(keyOf(row));
		const res = await pending;
		expect(res.status).toBe(200);
		expect(res.headers['x-og-image']).toBe('render');
		expect(res.body.toString()).toBe(`png:${keyOf(row)}`);
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

	it("serves the Share dialog the rendered image's bytes", async () => {
		const row = await quote();
		await rendered(keyOf(row, 'terminal'));
		const res = await get(
			`/v1/quotes/${row.publicId}/share-image?variant=terminal`
		);
		expect(res.status).toBe(200);
		expect(res.headers.location).toBeUndefined();
		expect(res.body.toString()).toBe(`png:${keyOf(row, 'terminal')}`);
		expect(res.headers['cache-control']).toBe('public, max-age=300');
	});

	it("gives a quote page's og:image the card the link asked for", async () => {
		const row = await quote();
		await rendered(keyOf(row));
		await rendered(keyOf(row, 'terminal'));
		const terminal = await get(
			`/v1/quotes/${row.publicId}/og.png?variant=terminal`
		);
		expect(terminal.headers['x-og-image']).toBe('render');
		expect(terminal.body.toString()).toBe(`png:${keyOf(row, 'terminal')}`);
		const plain = await get(`/v1/quotes/${row.publicId}/og.png`);
		expect(plain.body.toString()).toBe(`png:${keyOf(row)}`);
		expect(
			(await get(`/v1/quotes/${row.publicId}/og.png?variant=poster`)).status
		).toBe(400);
	});

	it('sends the rendered image itself, keyed by revision', async () => {
		const row = await quote();
		await rendered(keyOf(row));
		const res = await get(`/v1/quotes/${row.publicId}/og.png`);
		expect(res.status).toBe(200);
		expect(res.headers['content-type']).toBe('image/png');
		expect(res.headers.location).toBeUndefined();
		expect(res.body.toString()).toBe(`png:${keyOf(row)}`);
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
		const jobs = await queued();
		expect(jobs.map((j) => j.data.key).sort()).toEqual(
			[keyOf(corrected), keyOf(corrected, 'terminal')].sort()
		);
		// Drawn ahead: behind any render someone is waiting for.
		expect(jobs.every((j) => j.opts.priority === 10)).toBe(true);
		// The old revision's redirect is gone: the page now asks for the new one.
		const after = await get(`/v1/quotes/${row.publicId}/og.png`);
		expect(after.headers['x-og-image']).toBe('fallback');
		// …and someone waiting moves its render to the front.
		const job = (await queued()).find((j) => j.data.key === keyOf(corrected))!;
		expect(await job.getState()).toBe('waiting');
	});

	it("draws an author's card: name, lifespan and their shortest curated quote", async () => {
		await quote('CURATED', 'Simplicity is prerequisite for reliability.');
		await quote(
			'CURATED',
			'The question of whether a computer can think is no more interesting than the question of whether a submarine can swim.'
		);
		await app.db.author.update({
			where: { slug: 'dijkstra' },
			data: {
				bornYear: 1930,
				diedYear: 2002,
				description: 'computer scientist'
			}
		});
		const shortest = (
			await app.db.quote.findMany({
				where: { author: { slug: 'dijkstra' }, status: 'CURATED' }
			})
		).sort((a, b) => a.text.length - b.text.length)[0].text;
		const res = await get('/v1/authors/dijkstra/og.png');
		expect(res.headers['x-og-image']).toBe('fallback');
		const job = (await queued()).find(
			(j) => j.data.variant === 'page' && j.data.card.kind === 'author'
		);
		expect(job!.data).toMatchObject({
			key: expect.stringMatching(/^og\/authors\/dijkstra-[0-9a-f]{12}\.png$/),
			card: {
				path: '/authors/dijkstra',
				eyebrow: 'Author',
				title: 'Edsger W. Dijkstra',
				line: '1930–2002 · computer scientist',
				quote: { text: shortest, author: 'Edsger W. Dijkstra' }
			}
		});
		expect((await get('/v1/authors/nobody-at-all/og.png')).status).toBe(404);
	});

	it("draws a topic's card, and the site's", async () => {
		const topic = await app.db.topic.upsert({
			where: { slug: 'og-debugging' },
			update: {},
			create: {
				slug: 'og-debugging',
				name: 'og debugging',
				description: 'Finding out why.'
			}
		});
		await get(`/v1/topics/${topic.slug}/og.png`);
		const job = (await queued()).find(
			(j) => j.data.variant === 'page' && j.data.card.kind === 'topic'
		);
		expect(job!.data.card).toMatchObject({
			path: `/topics/${topic.slug}`,
			eyebrow: 'Topic',
			line: topic.description
		});
		expect((await get('/v1/topics/no-such-topic/og.png')).status).toBe(404);

		await rendered(siteKey);
		const site = await get('/v1/og.png');
		expect(site.status).toBe(200);
		expect(site.headers['x-og-image']).toBe('render');
		expect(site.body.toString()).toBe(`png:${siteKey}`);
	});

	it('backfills every card not drawn yet, behind waiting renders', async () => {
		const drawn = await quote();
		const missing = await quote();
		const hidden = await quote('PRIVATE');
		await rendered(keyOf(drawn));
		const service = app.instance.get(ShareImagesService);
		const counts = await service.backfill();
		const keys = (await queue.getJobs(['prioritized'])).map((j) => j.data.key);
		expect(keys).toContain(keyOf(missing));
		expect(keys).not.toContain(keyOf(drawn));
		expect(keys).not.toContain(keyOf(hidden));
		expect(keys.some((k) => k.startsWith('og/authors/dijkstra-'))).toBe(true);
		expect(keys.some((k) => k.startsWith('og/topics/'))).toBe(true);
		expect(counts.queued).toBe(keys.length);
		expect(await queue.getJobs(['waiting'])).toHaveLength(0);
	});
});
