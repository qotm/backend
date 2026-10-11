import { AppFactory } from '@test/factory/app';
import { recordAudit } from 'audit';

/**
 * The audit helper against the real test database: its row must commit and
 * roll back with the transaction it is written in.
 */
describe('Audit log', () => {
	let app: AppFactory;
	let actor: { id: string; handle: string };

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		actor = await app.db.user.findFirstOrThrow({
			select: { id: true, handle: true }
		});
	});

	afterAll(async () => {
		await app.close();
	});

	it('commits the audit row with the change it records', async () => {
		await app.db.$transaction(async (tx) => {
			await tx.topic.create({ data: { name: 'audited', slug: 'audited' } });
			await recordAudit(tx, {
				actor,
				action: 'topic.created',
				target: { type: 'topic', id: 'audited' }
			});
		});

		const row = await app.db.auditLog.findFirst({
			where: { action: 'topic.created', targetId: 'audited' }
		});
		expect(row).toMatchObject({ actorId: actor.id, actorHandle: actor.handle });
	});

	it('drops the audit row when the transaction rolls back', async () => {
		await expect(
			app.db.$transaction(async (tx) => {
				await tx.topic.create({
					data: { name: 'rolled back', slug: 'rolled-back' }
				});
				await recordAudit(tx, {
					actor,
					action: 'topic.created',
					target: { type: 'topic', id: 'rolled-back' }
				});
				throw new Error('the change failed');
			})
		).rejects.toThrow('the change failed');

		expect(
			await app.db.auditLog.count({ where: { targetId: 'rolled-back' } })
		).toBe(0);
		expect(await app.db.topic.count({ where: { slug: 'rolled-back' } })).toBe(
			0
		);
	});

	it('keeps the row and the handle when the actor is deleted', async () => {
		const user = await app.db.user.create({
			data: {
				id: 'audit-actor',
				name: 'Gone',
				email: 'gone@example.com',
				handle: 'gone'
			}
		});
		await app.db.$transaction((tx) =>
			recordAudit(tx, {
				actor: { id: user.id, handle: user.handle },
				action: 'user.role_changed',
				target: { type: 'user', id: 'kofi' }
			})
		);
		await app.db.user.delete({ where: { id: user.id } });

		const row = await app.db.auditLog.findFirstOrThrow({
			where: { actorHandle: 'gone' }
		});
		expect(row.actorId).toBeNull();
	});
});
