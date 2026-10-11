import { HANDLE_PATTERN, assignHandle, handleBase } from 'lib/handle';

/** A db double where `taken` handles belong to someone now or used to. */
function fakeDb(taken: string[]) {
	const has = (handle: string) => (taken.includes(handle) ? { id: 'x' } : null);
	return {
		user: {
			findUnique: vi.fn(({ where }) => Promise.resolve(has(where.handle)))
		},
		handleHistory: {
			findUnique: vi.fn(() => Promise.resolve(null))
		}
	} as unknown as Parameters<typeof assignHandle>[0];
}

describe('handleBase', () => {
	it("derives a handle from the email's local part", () => {
		expect(handleBase('ada@example.com')).toBe('ada');
		expect(handleBase('Ada.Mensah+qotm@example.com')).toBe('ada_mensah_qotm');
	});

	it('trims separators and caps the length, leaving room for a suffix', () => {
		expect(handleBase('__kofi--@example.com')).toBe('kofi');
		const long = handleBase(`${'a'.repeat(40)}@example.com`);
		expect(long).toHaveLength(24);
	});

	it('falls back when the local part is too short', () => {
		expect(handleBase('wc@example.com')).toBe('member');
		expect(handleBase('..@example.com')).toBe('member');
	});

	it('always yields a valid handle', () => {
		for (const email of ['ada@x.io', 'Ünïcode.name@x.io', 'a@x.io']) {
			expect(handleBase(email)).toMatch(HANDLE_PATTERN);
		}
	});
});

describe('assignHandle', () => {
	it('uses the base when it is free', async () => {
		await expect(assignHandle(fakeDb([]), 'ada@example.com')).resolves.toBe(
			'ada'
		);
	});

	it('adds a short suffix when the base is taken', async () => {
		const handle = await assignHandle(fakeDb(['ada']), 'ada@example.com');
		expect(handle).toMatch(/^ada_[0-9a-f]{4}$/);
		expect(handle).toMatch(HANDLE_PATTERN);
	});

	it('treats a handle someone used before as taken', async () => {
		const db = fakeDb([]);
		vi.mocked(db.handleHistory.findUnique).mockImplementation((({
			where
		}: {
			where: { oldHandle: string };
		}) =>
			Promise.resolve(
				where.oldHandle === 'ada' ? { id: 'h' } : null
			)) as never);
		await expect(assignHandle(db, 'ada@example.com')).resolves.not.toBe('ada');
	});
});
