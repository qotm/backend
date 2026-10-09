import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from 'common/services';
import { ensureEachExists, ensureExists, ensureUnique } from 'common/utils';

describe('record checks', () => {
	const exists = vi.fn();
	const db = { x: { user: { exists } } } as unknown as PrismaService;

	beforeEach(() => exists.mockReset());

	describe('ensureExists', () => {
		it('passes when a row has the value, matching case-insensitively', async () => {
			exists.mockResolvedValue(true);

			await expect(ensureExists(db, 'user', 'role', 'Admin')).resolves.toBe(
				undefined
			);
			expect(exists).toHaveBeenCalledWith({
				role: { equals: 'Admin', mode: 'insensitive' }
			});
		});

		it('rejects with a validation error when no row has it', async () => {
			exists.mockResolvedValue(false);

			await expect(ensureExists(db, 'user', 'role', 'ghost')).rejects.toThrow(
				new BadRequestException("Validation: role 'ghost' does not exist")
			);
		});

		it.each([undefined, null, ''])(
			'skips an empty value (%s)',
			async (value) => {
				await ensureExists(db, 'user', 'role', value);
				expect(exists).not.toHaveBeenCalled();
			}
		);
	});

	describe('ensureEachExists', () => {
		it('passes when every value exists', async () => {
			exists.mockResolvedValue(true);

			await ensureEachExists(db, 'user', 'id', ['a', 'b']);
			expect(exists).toHaveBeenCalledTimes(2);
		});

		it('names the first value that does not exist', async () => {
			exists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

			await expect(
				ensureEachExists(db, 'user', 'id', ['a', 'b', 'c'])
			).rejects.toThrow(
				new BadRequestException(
					"Validation: id element with id 'b' does not exist"
				)
			);
			expect(exists).toHaveBeenCalledTimes(2);
		});

		it('skips a missing list', async () => {
			await ensureEachExists(db, 'user', 'id', undefined);
			expect(exists).not.toHaveBeenCalled();
		});
	});

	describe('ensureUnique', () => {
		it('passes when no row has the value', async () => {
			exists.mockResolvedValue(false);
			await expect(
				ensureUnique(db, 'user', 'email', 'new@example.com')
			).resolves.toBe(undefined);
		});

		it('rejects with a validation error when the value is taken', async () => {
			exists.mockResolvedValue(true);

			await expect(
				ensureUnique(db, 'user', 'email', 'taken@example.com')
			).rejects.toThrow(
				new BadRequestException(
					"Validation: email 'taken@example.com' already exists"
				)
			);
		});
	});
});
