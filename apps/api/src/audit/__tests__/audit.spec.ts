import { AUDIT_ACTIONS, recordAudit } from 'audit';

function fakeTx() {
	const create = vi.fn(async ({ data }) => ({
		id: 'a1',
		at: new Date(),
		...data
	}));
	return { tx: { auditLog: { create } } as never, create };
}

describe('recordAudit', () => {
	it('writes the actor, action, target and note through the given client', async () => {
		const { tx, create } = fakeTx();
		await recordAudit(tx, {
			actor: { id: 'u1', handle: 'kofi' },
			action: 'quote.withdrawn',
			target: { type: 'quote', id: 'q_5d3a8w' },
			note: 'No source found; report r_0412'
		});

		expect(create).toHaveBeenCalledWith({
			data: {
				actorId: 'u1',
				actorHandle: 'kofi',
				action: 'quote.withdrawn',
				targetType: 'quote',
				targetId: 'q_5d3a8w',
				note: 'No source found; report r_0412'
			}
		});
	});

	it('records the system as a null actor and a missing note as null', async () => {
		const { tx, create } = fakeTx();
		await recordAudit(tx, {
			actor: null,
			action: 'release.preview_built',
			target: { type: 'release', id: 'v2026.09.1' }
		});

		expect(create.mock.calls[0][0].data).toMatchObject({
			actorId: null,
			actorHandle: null,
			note: null
		});
	});
});

describe('AUDIT_ACTIONS', () => {
	it('keeps every code short enough for the action column', () => {
		for (const code of Object.keys(AUDIT_ACTIONS)) {
			expect(code.length).toBeLessThanOrEqual(40);
			expect(code).toMatch(/^[a-z]+\.[a-z_]+$/);
		}
	});
});
