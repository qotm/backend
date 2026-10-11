import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AppFactory } from '@test/factory/app';
import { TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import { auth } from 'lib/auth';
import { BUILD_PREVIEW, PUBLISH_RELEASE, RELEASES_QUEUE } from 'releases';

/** Admin › Dataset releases, against the real test stack (no worker runs). */
describe('Admin releases', () => {
	let app: AppFactory;
	let admin: string;
	let queue: Queue;

	const now = new Date();
	const month = `v${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		admin = (await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password)).cookie!;
		queue = app.instance.get(getQueueToken(RELEASES_QUEUE));
	});

	afterEach(async () => {
		await queue.obliterate({ force: true });
	});

	afterAll(async () => {
		await app.close();
	});

	const list = (cookie = admin) =>
		app.request.get('/v1/admin/releases').set('Cookie', cookie);
	const preview = (cookie = admin) =>
		app.request.post('/v1/admin/releases/preview').set('Cookie', cookie);
	const publish = (version: string, body: object, cookie = admin) =>
		app.request
			.post(`/v1/admin/releases/${version}/publish`)
			.set('Cookie', cookie)
			.send(body);
	/** What the worker's build would leave behind. */
	const built = (version: string) =>
		app.db.release.update({
			where: { version },
			data: {
				state: 'PREVIEW',
				sha256: 'a'.repeat(64),
				sizeBytes: 2900,
				eligibleCount: 3,
				addedCount: 3,
				previewBuiltAt: new Date()
			}
		});

	it('is for admins only', async () => {
		expect((await app.request.get('/v1/admin/releases')).status).toBe(401);
		const member = (await app.signIn(TEST_USER.email, TEST_USER.password))
			.cookie!;
		const email = 'moderator.rel@example.com';
		await auth.api.createUser({
			body: { name: 'Mod', email, password: 'secret', role: 'moderator' }
		});
		await app.db.user.update({
			where: { email },
			data: { emailVerified: true }
		});
		const moderator = (await app.signIn(email, 'secret')).cookie!;
		for (const cookie of [member, moderator]) {
			expect((await list(cookie)).status).toBe(403);
			expect((await preview(cookie)).status).toBe(403);
			expect(
				(await publish('v2026.01.1', { reviewed: true }, cookie)).status
			).toBe(403);
		}
		expect(await queue.count()).toBe(0);
	});

	it('opens the month’s first release and queues one build at a time', async () => {
		const res = await preview();
		expect(res.status).toBe(202);
		expect(res.body).toMatchObject({
			queued: true,
			release: { version: `${month}.1`, state: 'DRAFT', schemaVersion: 1 }
		});
		const [job] = await queue.getJobs(['waiting']);
		expect(job).toMatchObject({
			name: BUILD_PREVIEW,
			data: { actor: { handle: 'test_admin' } }
		});

		expect((await preview()).status).toBe(409);
		expect(await queue.count()).toBe(1);
		expect((await list()).body).toMatchObject({
			building: true,
			current: { version: `${month}.1`, state: 'DRAFT', changes: '+0 ~0 −0' },
			list: [],
			total: 0
		});
	});

	it('rebuilds the open release rather than opening another', async () => {
		await built(`${month}.1`);
		const res = await preview();
		expect(res.body.release).toMatchObject({
			version: `${month}.1`,
			state: 'PREVIEW'
		});
		expect(await app.db.release.count()).toBe(1);
	});

	describe('publishing', () => {
		it('needs the review confirmation', async () => {
			expect((await publish(`${month}.1`, {})).status).toBe(400);
			expect((await publish(`${month}.1`, { reviewed: false })).status).toBe(
				400
			);
		});

		it('is refused while a build is running', async () => {
			await preview();
			expect((await publish(`${month}.1`, { reviewed: true })).status).toBe(
				409
			);
		});

		it('queues the publish of a built preview, once', async () => {
			const res = await publish(`${month}.1`, { reviewed: true });
			expect(res.status).toBe(202);
			expect(res.body.release).toMatchObject({
				version: `${month}.1`,
				state: 'PREVIEW',
				eligible: 3,
				changes: '+3 ~0 −0'
			});
			const [job] = await queue.getJobs(['waiting']);
			expect(job).toMatchObject({
				name: PUBLISH_RELEASE,
				data: { actor: { handle: 'test_admin' } }
			});
			expect((await publish(`${month}.1`, { reviewed: true })).status).toBe(
				409
			);
		});

		it('refuses a draft without a preview, a published release, and an unknown one', async () => {
			await app.db.release.update({
				where: { version: `${month}.1` },
				data: { state: 'PUBLISHED', publishedAt: new Date() }
			});
			expect((await publish(`${month}.1`, { reviewed: true })).status).toBe(
				409
			);
			expect((await publish('v1999.01.1', { reviewed: true })).status).toBe(
				404
			);

			await preview(); // opens the next release, a draft
			await queue.obliterate({ force: true });
			expect((await publish(`${month}.2`, { reviewed: true })).status).toBe(
				409
			);
		});
	});

	it('numbers releases within the month and lists the published ones', async () => {
		const res = await list();
		expect(res.body).toMatchObject({
			current: { version: `${month}.2`, state: 'DRAFT' },
			building: false,
			total: 1,
			list: [{ version: `${month}.1`, state: 'PUBLISHED', eligible: 3 }]
		});
	});
});
