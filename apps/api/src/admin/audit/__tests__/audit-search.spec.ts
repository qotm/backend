import { searchOf } from 'admin/audit/services';

describe('searchOf', () => {
	it('matches an action by its label or code', () => {
		expect(searchOf('withdrew')).toContainEqual({
			action: { in: ['quote.withdrawn'] }
		});
		expect(searchOf('role_changed')).toContainEqual({
			action: { in: ['user.role_changed'] }
		});
	});

	it('drops the "@" of a handle', () => {
		expect(searchOf('@kofi')[0]).toEqual({
			actorHandle: { contains: 'kofi', mode: 'insensitive' }
		});
	});

	it('leaves out the action clause when no action matches', () => {
		expect(searchOf('q_5d3a8w')).toHaveLength(3);
	});
});
