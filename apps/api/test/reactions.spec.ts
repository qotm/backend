import { AppFactory } from '@test/factory/app';
import { setReaction, type ReactionKind } from 'reactions';

/**
 * Reaction counts against the real test database, under concurrent writes:
 * the denormalised count on Quote must always equal the rows behind it.
 */
describe('Reactions', () => {
	let app: AppFactory;
	let userIds: string[];
	let quoteId: string;
	let canonicalId: string;

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();

		userIds = [];
		for (let i = 0; i < 8; i++) {
			const user = await app.db.user.create({
				data: {
					id: `reactor-${i}`,
					name: `Reactor ${i}`,
					email: `reactor${i}@example.com`,
					handle: `reactor_${i}`
				}
			});
			userIds.push(user.id);
		}
		const quote = await app.db.quote.create({
			data: {
				publicId: 'q_react1',
				text: 'Read the error message twice before you read the code once.',
				type: 'ORIGINAL',
				status: 'PUBLISHED'
			}
		});
		quoteId = quote.id;
		const canonical = await app.db.quote.create({
			data: {
				publicId: 'q_react2',
				text: 'Talk is cheap. Show me the code.',
				type: 'CANONICAL',
				status: 'VERIFIED'
			}
		});
		canonicalId = canonical.id;
	});

	afterAll(async () => {
		await app.close();
	});

	async function counts() {
		const quote = await app.db.quote.findUniqueOrThrow({
			where: { id: quoteId }
		});
		return {
			like: [quote.likeCount, await app.db.like.count({ where: { quoteId } })],
			favorite: [
				quote.favoriteCount,
				await app.db.favorite.count({ where: { quoteId } })
			],
			recommend: [
				quote.recommendCount,
				await app.db.recommendation.count({ where: { quoteId } })
			]
		};
	}

	it('counts one like however many times one member sends it at once', async () => {
		await Promise.all(
			Array.from({ length: 20 }, () =>
				setReaction(app.db, 'like', { userId: userIds[0], quoteId }, true)
			)
		);
		expect((await counts()).like).toEqual([1, 1]);

		await Promise.all(
			Array.from({ length: 20 }, () =>
				setReaction(app.db, 'like', { userId: userIds[0], quoteId }, false)
			)
		);
		expect((await counts()).like).toEqual([0, 0]);
	});

	it('keeps every count equal to its rows under concurrent mixed toggles', async () => {
		const kinds: ReactionKind[] = ['like', 'favorite', 'recommend'];
		// A fixed pseudo-random sequence, so a failure reproduces.
		let seed = 42;
		const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31);

		for (let round = 0; round < 5; round++) {
			await Promise.all(
				Array.from({ length: 60 }, () => {
					const kind = kinds[next() % kinds.length];
					const userId = userIds[next() % userIds.length];
					return setReaction(
						app.db,
						kind,
						{ userId, quoteId },
						next() % 2 === 0
					);
				})
			);
			const c = await counts();
			expect(c.like[0]).toBe(c.like[1]);
			expect(c.favorite[0]).toBe(c.favorite[1]);
			expect(c.recommend[0]).toBe(c.recommend[1]);
		}
	});

	it('refuses to recommend a canonical quote', async () => {
		await expect(
			setReaction(
				app.db,
				'recommend',
				{ userId: userIds[0], quoteId: canonicalId },
				true
			)
		).rejects.toThrow('Only community originals can be recommended');
		expect(
			await app.db.recommendation.count({ where: { quoteId: canonicalId } })
		).toBe(0);
	});
});
