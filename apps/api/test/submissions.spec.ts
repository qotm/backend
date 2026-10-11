import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AppFactory } from '@test/factory/app';
import { TEST_ADMIN, TEST_USER } from '@test/factory/constants';

/** Submissions, the live match and my quotes, against the real test stack. */
describe('Submissions', () => {
	let app: AppFactory;
	let userCookie: string;
	let otherCookie: string;
	let matching: Queue;

	const canonical = {
		type: 'canonical',
		text: '“Premature optimization is the root of all evil.”',
		attribution: 'donald e. knuth',
		source: 'Structured Programming with go to Statements',
		year: 1974,
		topics: ['programming']
	};

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		userCookie = (await app.signIn(TEST_USER.email, TEST_USER.password))
			.cookie!;
		otherCookie = (await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password))
			.cookie!;
		matching = app.instance.get(getQueueToken('matching'));

		const knuth = await app.db.author.create({
			data: { slug: 'knuth', name: 'Donald E. Knuth' }
		});
		await app.db.source.create({
			data: {
				title: 'Structured Programming with go to Statements',
				authorId: knuth.id,
				year: 1974,
				kind: 'PAPER'
			}
		});
		// The public corpus the match compares against, plus a private quote it
		// must never reveal.
		await app.db.quote.create({
			data: {
				publicId: 'q_knuth1',
				text: 'We should forget about small efficiencies, say about 97% of the time: premature optimization is the root of all evil.',
				type: 'CANONICAL',
				status: 'VERIFIED',
				publishedAt: new Date(),
				authorId: knuth.id
			}
		});
		await app.db.quote.create({
			data: {
				publicId: 'q_secret',
				text: 'A secret thought nobody else should ever be shown by a match.',
				type: 'PRIVATE',
				status: 'PRIVATE'
			}
		});
	});

	afterAll(async () => {
		await app.close();
	});

	const submit = (body: object, cookie = userCookie) =>
		app.request.post('/v1/submissions').set('Cookie', cookie).send(body);

	describe('POST /v1/submissions', () => {
		it('needs a session', async () => {
			expect(
				(await app.request.post('/v1/submissions').send(canonical)).status
			).toBe(401);
		});

		it('takes a canonical quote: marks stripped, known author and source linked, sent to verification', async () => {
			const res = await submit(canonical);
			expect(res.status).toBe(201);
			expect(res.body).toMatchObject({
				type: 'canonical',
				status: 'SUBMITTED',
				text: 'Premature optimization is the root of all evil.',
				author: { slug: 'knuth', name: 'Donald E. Knuth' },
				attribution: 'donald e. knuth',
				source: { title: 'Structured Programming with go to Statements' },
				year: 1974,
				lifecycle: [{ status: 'SUBMITTED' }]
			});
			// Not public yet: its contributor sees it, nobody else does.
			expect((await app.request.get(`/v1/quotes/${res.body.id}`)).status).toBe(
				404
			);
		});

		it('keeps an unknown author as typed, for a verifier to link', async () => {
			const res = await submit({
				...canonical,
				attribution: 'Someone Unknown',
				text: 'An entirely new canonical quote for testing.'
			});
			expect(res.body).toMatchObject({
				author: null,
				attribution: 'Someone Unknown',
				source: null
			});
		});

		it.each([
			[
				'a canonical quote without its author',
				{ ...canonical, attribution: undefined }
			],
			[
				'a canonical quote without its source',
				{ ...canonical, source: undefined }
			],
			[
				'an original without the rights confirmation',
				{
					type: 'original',
					text: 'Mine, all mine, every word.',
					topics: ['learning']
				}
			],
			['a quote over 280 characters', { ...canonical, text: 'x'.repeat(281) }],
			['a public quote without a topic', { ...canonical, topics: [] }],
			['an unknown topic', { ...canonical, topics: ['astrology'] }]
		])('rejects %s', async (_, body) => {
			expect((await submit(body)).status).toBe(400);
		});

		it('counts 280 characters after the quotation marks are stripped', async () => {
			const res = await submit({ ...canonical, text: `“${'y'.repeat(280)}”` });
			expect(res.status).toBe(201);
			expect(res.body.text).toHaveLength(280);
		});

		it('sends an original to the originality check and queues the job', async () => {
			const res = await submit({
				type: 'original',
				text: 'A green build is a hypothesis, not a proof.',
				topics: ['software-engineering'],
				rights: true
			});
			expect(res.status).toBe(201);
			expect(res.body).toMatchObject({
				type: 'original',
				status: 'ORIGINALITY_CHECK',
				lifecycle: [{ status: 'SUBMITTED' }, { status: 'ORIGINALITY_CHECK' }]
			});
			const quote = await app.db.quote.findUniqueOrThrow({
				where: { publicId: res.body.id }
			});
			const job = await matching.getJob(`originality-${quote.id}`);
			expect(job).toMatchObject({
				name: 'check-originality',
				data: { quoteId: quote.id }
			});
		});

		it('keeps a private quote private', async () => {
			const res = await submit({
				type: 'private',
				text: 'Ship the smallest thing that teaches you something.'
			});
			expect(res.status).toBe(201);
			expect(res.body).toMatchObject({ type: 'private', status: 'PRIVATE' });
			expect(
				(
					await app.request
						.get(`/v1/quotes/${res.body.id}`)
						.set('Cookie', otherCookie)
				).status
			).toBe(404);
		});
	});

	describe('POST /v1/quotes/match', () => {
		const match = (text: string) =>
			app.request
				.post('/v1/quotes/match')
				.set('Cookie', userCookie)
				.send({ text });

		it('finds the typed words inside a longer public quote', async () => {
			const res = await match(
				'Premature optimization is the root of all evil.'
			);
			expect(res.status).toBe(200);
			expect(res.body).toMatchObject({
				match: { id: 'q_knuth1', author: 'Donald E. Knuth' },
				method: 'fuzzy'
			});
			expect(res.body.score).toBeGreaterThan(0.8);
		});

		it('calls a match exact when only case and punctuation differ', async () => {
			const res = await match(
				'we should forget about small efficiencies say about 97 of the time premature optimization is the root of all evil'
			);
			expect(res.body).toMatchObject({ method: 'exact', score: 1 });
		});

		it('never matches a private or unreviewed quote', async () => {
			const res = await match(
				'A secret thought nobody else should ever be shown by a match.'
			);
			expect(res.body.match).toBeNull();
		});

		it('answers nothing for text too short to compare', async () => {
			expect((await match('premature')).body).toEqual({
				match: null,
				method: null,
				score: null
			});
		});
	});

	describe('/v1/me/quotes', () => {
		let privateId: string;
		let reviewId: string;
		let publicId: string;
		let evidenceId: string;

		beforeAll(async () => {
			privateId = (
				await submit({
					type: 'private',
					text: 'A private note to keep editing.',
					topics: ['learning']
				})
			).body.id;
			reviewId = (
				await submit({
					...canonical,
					text: 'A canonical quote still waiting for its verifier.'
				})
			).body.id;
			const user = await app.db.user.findUniqueOrThrow({
				where: { email: TEST_USER.email }
			});
			publicId = (
				await app.db.quote.create({
					data: {
						publicId: 'q_mine01',
						text: 'Already public.',
						type: 'CANONICAL',
						status: 'VERIFIED',
						publishedAt: new Date(),
						contributorId: user.id
					}
				})
			).publicId;
			evidenceId = (
				await app.db.quote.create({
					data: {
						publicId: 'q_needev',
						text: 'Needs a primary source.',
						type: 'CANONICAL',
						status: 'NEEDS_EVIDENCE',
						contributorId: user.id,
						reviews: {
							create: {
								kind: 'VERIFICATION',
								outcome: 'NEEDS_EVIDENCE',
								note: 'A verifier needs a primary source.'
							}
						}
					}
				})
			).publicId;
		});

		it('lists only my quotes, with tab counts and the reviewer’s note', async () => {
			const res = await app.request
				.get('/v1/me/quotes')
				.set('Cookie', userCookie);
			expect(res.status).toBe(200);
			expect(res.body.list.map((q: { id: string }) => q.id)).toContain(
				privateId
			);
			const mine = await app.request
				.get('/v1/me/quotes')
				.set('Cookie', otherCookie);
			expect(mine.body.list).toEqual([]);

			const needs = res.body.list.find(
				(q: { id: string }) => q.id === evidenceId
			);
			expect(needs.review).toMatchObject({
				note: 'A verifier needs a primary source.'
			});
			expect(res.body.tabs.all).toBe(
				res.body.tabs.private + res.body.tabs.review + res.body.tabs.public
			);
		});

		it.each([
			['private', (q: { type: string }) => q.type === 'private'],
			[
				'review',
				(q: { status: string }) =>
					[
						'SUBMITTED',
						'UNDER_REVIEW',
						'NEEDS_EVIDENCE',
						'ORIGINALITY_CHECK'
					].includes(q.status)
			],
			[
				'public',
				(q: { status: string; type: string }) =>
					q.type !== 'private' && q.status === 'VERIFIED'
			]
		])('filters the %s tab', async (tab, belongs) => {
			const res = await app.request
				.get('/v1/me/quotes')
				.query({ tab })
				.set('Cookie', userCookie);
			expect(res.body.list.length).toBe(res.body.tabs[tab]);
			expect(res.body.list.length).toBeGreaterThan(0);
			expect(res.body.list.every(belongs)).toBe(true);
		});

		it('edits a private quote, but not a submitted one or someone else’s', async () => {
			const edit = (id: string, cookie = userCookie) =>
				app.request
					.patch(`/v1/me/quotes/${id}`)
					.set('Cookie', cookie)
					.send({ text: 'Edited private note.' });
			const res = await edit(privateId);
			expect(res.status).toBe(200);
			expect(res.body.text).toBe('Edited private note.');
			expect((await edit(reviewId)).status).toBe(409);
			expect((await edit(privateId, otherCookie)).status).toBe(404);
		});

		it('adds evidence to a quote sent back, returning it to review', async () => {
			const send = (id: string) =>
				app.request
					.post(`/v1/submissions/${id}/evidence`)
					.set('Cookie', userCookie)
					.send({
						note: 'Page 268 of the paper.',
						sourceUrl: 'https://example.com/paper.pdf'
					});
			const res = await send(evidenceId);
			expect(res.status).toBe(200);
			expect(res.body).toMatchObject({
				status: 'UNDER_REVIEW',
				sourceUrl: 'https://example.com/paper.pdf'
			});
			expect((await send(reviewId)).status).toBe(409);
		});

		it('submits a private quote as an original, with the rights confirmation', async () => {
			const without = await app.request
				.post(`/v1/me/quotes/${privateId}/submit`)
				.set('Cookie', userCookie)
				.send({});
			expect(without.status).toBe(400);
			const res = await app.request
				.post(`/v1/me/quotes/${privateId}/submit`)
				.set('Cookie', userCookie)
				.send({ rights: true });
			expect(res.status).toBe(200);
			expect(res.body).toMatchObject({
				type: 'original',
				status: 'ORIGINALITY_CHECK'
			});
			const quote = await app.db.quote.findUniqueOrThrow({
				where: { publicId: privateId }
			});
			expect(await matching.getJob(`originality-${quote.id}`)).toBeDefined();
		});

		it('withdraws a submission in review, keeps a public one, deletes a private one', async () => {
			const del = (id: string) =>
				app.request.delete(`/v1/me/quotes/${id}`).set('Cookie', userCookie);

			expect((await del(reviewId)).status).toBe(200);
			const withdrawn = await app.db.quote.findUniqueOrThrow({
				where: { publicId: reviewId }
			});
			expect(withdrawn.status).toBe('WITHDRAWN');

			expect((await del(publicId)).status).toBe(409);

			const scratch = (await submit({ type: 'private', text: 'Scratch that.' }))
				.body.id;
			expect((await del(scratch)).status).toBe(200);
			expect(
				await app.db.quote.findUnique({ where: { publicId: scratch } })
			).toBeNull();
		});
	});

	describe('match speed on a 13,000-quote corpus', () => {
		const WORDS =
			'code program debug simple complex system design test build ship error memory cache name thing state data type function abstraction bug fix release user server network latency scale tool language compile runtime proof hypothesis reliability optimization premature evil root time small efficiency software engineer'.split(
				' '
			);

		beforeAll(async () => {
			let seed = 7;
			const rand = (n: number) =>
				(seed = (seed * 1103515245 + 12345) % 2 ** 31) % n;
			const rows = Array.from({ length: 13_000 }, (_, i) => ({
				publicId: `q_${i.toString(36).padStart(6, '0')}`,
				text:
					Array.from(
						{ length: 8 + rand(14) },
						() => WORDS[rand(WORDS.length)]
					).join(' ') + '.',
				type: 'CANONICAL' as const,
				status: 'VERIFIED' as const,
				publishedAt: new Date()
			}));
			for (let i = 0; i < rows.length; i += 2_000) {
				await app.db.quote.createMany({ data: rows.slice(i, i + 2_000) });
			}
			await app.db.$executeRawUnsafe('ANALYZE quotes');
		});

		it('answers in under 200 ms', async () => {
			const texts = [
				'Premature optimization is the root of all evil.',
				'Simple code is easier to debug than complex code.',
				'A green build is a hypothesis, not a proof.',
				'Make it work, make it right, make it fast.',
				'There are only two hard things: cache invalidation and naming things.'
			];
			// Warm up the connection pool and plan cache.
			await app.request
				.post('/v1/quotes/match')
				.set('Cookie', userCookie)
				.send({ text: texts[0] });
			const times: number[] = [];
			for (const text of [...texts, ...texts]) {
				const start = performance.now();
				const res = await app.request
					.post('/v1/quotes/match')
					.set('Cookie', userCookie)
					.send({ text });
				times.push(performance.now() - start);
				expect(res.status).toBe(200);
			}
			times.sort((a, b) => a - b);
			const p90 = times[Math.floor(times.length * 0.9) - 1];
			expect(p90).toBeLessThan(200);
		});
	});
});
