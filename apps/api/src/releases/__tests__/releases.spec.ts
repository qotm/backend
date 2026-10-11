import { ConflictException, NotFoundException } from '@nestjs/common';
import { recordPreview, updateRelease } from 'releases';

/** A db double whose conditional writes match `matched` rows. */
function fakeDb(
	matched: number,
	release: { version: string; state: string } | null
) {
	return {
		release: {
			updateMany: vi.fn(async () => ({ count: matched })),
			findUnique: vi.fn(async () => release)
		},
		$transaction: vi.fn()
	} as never as Parameters<typeof updateRelease>[0] & {
		release: { updateMany: ReturnType<typeof vi.fn> };
	};
}

describe('release writes', () => {
	it('only ever matches an unpublished release', async () => {
		const db = fakeDb(1, null);
		await updateRelease(db, 'r1', { addedCount: 3 });
		expect(db.release.updateMany).toHaveBeenCalledWith({
			where: { id: 'r1', state: { not: 'PUBLISHED' } },
			data: { addedCount: 3 }
		});
	});

	it('refuses a published release with a 409 naming its version', async () => {
		const db = fakeDb(0, { version: 'v2026.08.3', state: 'PUBLISHED' });
		await expect(updateRelease(db, 'r1', { addedCount: 3 })).rejects.toThrow(
			new ConflictException(
				'Release v2026.08.3 is published and cannot be changed'
			)
		);
	});

	it('404s a release that does not exist', async () => {
		const db = fakeDb(0, null);
		await expect(
			recordPreview(db, 'nope', {
				sizeBytes: 1,
				sha256: 'a'.repeat(64),
				artifactKey: 'k',
				manifestKey: 'm'
			})
		).rejects.toThrow(NotFoundException);
	});
});
