import { AppFactory } from '@test/factory/app';
import { TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import type { QuoteStatus, QuoteType } from '@qotm/db/enums';

let n = 0;
/** A distinct client address, so rate-limit buckets never leak between requests. */
const client = () => `10.29.${Math.floor(++n / 250)}.${n % 250}`;

async function quote(
	app: AppFactory,
	status: QuoteStatus,
	type: QuoteType = 'CANONICAL'
) {
	const publicId = `q_rp${String(++n).padStart(4, '0')}`;
	return app.db.quote.create({
		data: {
			publicId,
			type,
			status,
			text: `Reportable ${publicId}`,
			publishedAt: new Date()
		}
	});
}

describe('Reports', () => {
	let app: AppFactory;
	let user: string;
	let other: string;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		user = (await app.signIn(TEST_USER.email, TEST_USER.password)).cookie!;
		other = (await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password)).cookie!;
	});

	afterAll(async () => {
		await app.close();
	});

	const report = (
		id: string,
		body: object = { reason: 'attribution' },
		cookie = user
	) =>
		app.request
			.post(`/v1/quotes/${id}/reports`)
			.set('Cookie', cookie)
			.set('X-Forwarded-For', client())
			.send(body);

	it('needs a session', async () => {
		const q = await quote(app, 'VERIFIED');
		expect(
			(
				await app.request
					.post(`/v1/quotes/${q.publicId}/reports`)
					.send({ reason: 'content' })
			).status
		).toBe(401);
	});

	it('files a report as r_####, leaving the quote up', async () => {
		const q = await quote(app, 'CURATED');
		const res = await report(q.publicId, {
			reason: 'attribution',
			details: 'This is usually traced to a talk, not to his writing.'
		});
		expect(res.status).toBe(201);
		expect(res.body).toMatchObject({
			id: expect.stringMatching(/^r_\d{4,}$/),
			quote: q.publicId,
			reason: 'attribution',
			status: 'SUBMITTED'
		});
		expect(
			(await app.db.quote.findUniqueOrThrow({ where: { id: q.id } })).status
		).toBe('CURATED');
		expect((await app.request.get(`/v1/quotes/${q.publicId}`)).status).toBe(
			200
		);
	});

	it.each([
		['an unknown reason', { reason: 'boring' }],
		[
			'details over 2000 characters',
			{ reason: 'other', details: 'x'.repeat(2001) }
		]
	])('rejects %s', async (_, body) => {
		const q = await quote(app, 'VERIFIED');
		expect((await report(q.publicId, body)).status).toBe(400);
	});

	it.each(['PRIVATE', 'SUBMITTED', 'WITHDRAWN'] as const)(
		'404s a %s quote',
		async (status) => {
			const q = await quote(
				app,
				status,
				status === 'PRIVATE' ? 'PRIVATE' : 'CANONICAL'
			);
			expect((await report(q.publicId)).status).toBe(404);
		}
	);

	it('404s an unknown quote', async () => {
		expect((await report('q_zzzzzz')).status).toBe(404);
		expect((await report('nonsense')).status).toBe(404);
	});

	it('keeps one open report per member per quote, but others may report too', async () => {
		const q = await quote(app, 'VERIFIED');
		const first = await report(q.publicId);
		const again = await report(q.publicId, { reason: 'content' });
		expect(again.status).toBe(409);
		expect(again.body.message).toContain(first.body.id);
		expect(
			(await report(q.publicId, { reason: 'content' }, other)).status
		).toBe(201);
	});

	it('lets a member report again once their report is resolved', async () => {
		const q = await quote(app, 'VERIFIED');
		await report(q.publicId);
		await app.db.report.updateMany({
			where: { quoteId: q.id },
			data: { status: 'RESOLVED' }
		});
		expect((await report(q.publicId)).status).toBe(201);
	});

	it('files exactly one of several simultaneous reports', async () => {
		const q = await quote(app, 'VERIFIED');
		const results = await Promise.all(
			Array.from({ length: 5 }, () => report(q.publicId))
		);
		expect(results.filter((r) => r.status === 201)).toHaveLength(1);
		expect(results.filter((r) => r.status === 409)).toHaveLength(4);
		expect(await app.db.report.count({ where: { quoteId: q.id } })).toBe(1);
	});
});

describe('Reports rate limit', () => {
	let app: AppFactory;
	let user: string;
	const previous = process.env.RATE_LIMIT_ENABLED;

	beforeAll(async () => {
		process.env.RATE_LIMIT_ENABLED = 'true';
		app = await AppFactory.init();
		await app.refresh();
		user = (await app.signIn(TEST_USER.email, TEST_USER.password)).cookie!;
	});

	afterAll(async () => {
		await app.close();
		process.env.RATE_LIMIT_ENABLED = previous;
	});

	it('allows ten reports an hour from one client, then 429s', async () => {
		const ip = '10.29.255.1';
		const quotes = await Promise.all(
			Array.from({ length: 11 }, () => quote(app, 'VERIFIED'))
		);
		for (const q of quotes.slice(0, 10)) {
			const res = await app.request
				.post(`/v1/quotes/${q.publicId}/reports`)
				.set('Cookie', user)
				.set('X-Forwarded-For', ip)
				.send({ reason: 'other' });
			expect(res.status).toBe(201);
		}
		const res = await app.request
			.post(`/v1/quotes/${quotes[10].publicId}/reports`)
			.set('Cookie', user)
			.set('X-Forwarded-For', ip)
			.send({ reason: 'other' });
		expect(res.status).toBe(429);
	});
});
