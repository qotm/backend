import { AppFactory } from '@test/factory/app';
import { TEST_USER } from '@test/factory/constants';
import type { QuoteStatus, QuoteType } from '@qotm/db/enums';

/** Public profiles and their tabs, against the real test stack. */
describe('Profiles', () => {
	let app: AppFactory;
	let userId: string;

	let n = 0;
	async function quote(
		status: QuoteStatus,
		type: QuoteType = 'CANONICAL',
		extra: object = {}
	) {
		return app.db.quote.create({
			data: {
				publicId: `q_pr${String(++n).padStart(4, '0')}`,
				text: `Profile quote ${n}`,
				type,
				status,
				contributorId: userId,
				createdAt: new Date(Date.UTC(2026, 8, n)),
				...extra
			}
		});
	}

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		const user = await app.db.user.update({
			where: { email: TEST_USER.email },
			data: {
				name: 'Ada Mensah',
				bio: 'Reads old papers so you don’t have to.',
				role: 'verifier'
			}
		});
		userId = user.id;

		const curated = await quote('DATASET_RELEASE', 'CANONICAL', {
			verifiedAt: new Date()
		});
		await quote('VERIFIED', 'CANONICAL', { verifiedAt: new Date() });
		await quote('PUBLISHED', 'ORIGINAL');
		await quote('NEEDS_EVIDENCE');
		await quote('PRIVATE', 'PRIVATE'); // never on a profile
		await quote('SUBMITTED'); // not public yet
		await app.db.release.create({
			data: {
				version: 'v2026.08.3',
				state: 'PUBLISHED',
				schemaVersion: 1,
				publishedAt: new Date(),
				quotes: { create: { quoteId: curated.id, textAtRelease: curated.text } }
			}
		});
		await app.db.correction.create({
			data: { quoteId: curated.id, oldText: 'a', newText: 'b', actorId: userId }
		});
	});

	afterAll(async () => {
		await app.close();
	});

	const get = (path: string) => app.request.get(path).redirects(0);

	it('shows the profile publicly, never the email', async () => {
		const res = await get('/v1/users/test_user');
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			handle: 'test_user',
			name: 'Ada Mensah',
			role: 'verifier',
			bio: 'Reads old papers so you don’t have to.',
			joinedAt: expect.any(String),
			stats: { quotes: 1, contributions: 4, curated: 1 }
		});
		expect(JSON.stringify(res.body)).not.toContain('@example.com');
	});

	it('shows the superuser as an admin', async () => {
		const su = await app.db.user.findFirstOrThrow({
			where: { role: 'superuser' }
		});
		expect((await get(`/v1/users/${su.handle}`)).body.role).toBe('admin');
	});

	it('404s an unknown handle', async () => {
		expect((await get('/v1/users/nobody_here')).status).toBe(404);
	});

	it('redirects an old handle to the current one, tabs included', async () => {
		await app.db.handleHistory.create({
			data: { userId, oldHandle: 'ada_old' }
		});
		const res = await get('/v1/users/ada_old');
		expect(res.status).toBe(301);
		expect(res.headers.location).toBe('/v1/users/test_user');
		const tab = await get('/v1/users/@ADA_OLD/contributions');
		expect(tab.headers.location).toBe('/v1/users/test_user/contributions');
	});

	it('lists public contributions newest first, with their release', async () => {
		const res = await get('/v1/users/test_user/contributions');
		expect(res.body.total).toBe(4);
		expect(res.body.list.map((c: { status: string }) => c.status)).toEqual([
			'NEEDS_EVIDENCE',
			'PUBLISHED',
			'VERIFIED',
			'DATASET_RELEASE'
		]);
		expect(res.body.list[3]).toMatchObject({
			type: 'canonical',
			release: 'v2026.08.3'
		});
		expect(res.body.list[1]).toMatchObject({ type: 'original', release: null });
		expect(JSON.stringify(res.body)).not.toContain('@example.com');
	});

	it('pages contributions', async () => {
		const res = await get('/v1/users/test_user/contributions?limit=3&page=2');
		expect(res.body).toMatchObject({ currentPage: 2, lastPage: 2, total: 4 });
		expect(res.body.list).toHaveLength(1);
	});

	it('counts submitted, verified, curated and corrections accepted', async () => {
		expect((await get('/v1/users/test_user/stats')).body).toEqual({
			submitted: 4,
			verified: 2,
			curated: 1,
			correctionsAccepted: 1
		});
	});

	it('shows favorites only when the member made them public', async () => {
		const liked = await app.db.quote.create({
			data: {
				publicId: 'q_prfav1',
				text: 'A favorite.',
				type: 'CANONICAL',
				status: 'CURATED',
				publishedAt: new Date()
			}
		});
		await app.db.favorite.create({ data: { userId, quoteId: liked.id } });
		expect((await get('/v1/users/test_user/favorites')).status).toBe(404);

		await app.db.user.update({
			where: { id: userId },
			data: { showFavorites: true }
		});
		const res = await get('/v1/users/test_user/favorites');
		expect(res.status).toBe(200);
		expect(res.body.list.map((q: { id: string }) => q.id)).toEqual([
			'q_prfav1'
		]);
	});
});
