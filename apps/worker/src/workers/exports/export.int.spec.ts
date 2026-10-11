import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB } from '#app/db.js';
import type { Storage } from '#lib/storage.js';
import {
	TrackedStorage,
	resetReleaseTables
} from '#app/workers/releases/testing.js';
import { EXPORT_COLUMNS, exportQuotes } from './export.js';

const ROWS = 13_000;

/** The CSV export against the test database and the real bucket. */
describe('exportQuotes', () => {
	const db = DB.instance;
	const storage = new TrackedStorage();
	const prefix = `exports/test-${Date.now().toString(36)}`;
	const requestedBy = { id: 'admin-id', handle: 'mireille' };

	beforeAll(async () => {
		await resetReleaseTables(db);
		const author = await db.author.create({
			data: { slug: 'dijkstra', name: 'Edsger W. Dijkstra' }
		});
		await db.quote.createMany({
			data: Array.from({ length: ROWS }, (_, i) => ({
				publicId: `q_${i.toString(36).padStart(6, '0')}`,
				text: i === 0 ? 'Commas, "quotes"\nand lines.' : `Exported quote ${i}`,
				type: 'CANONICAL' as const,
				status: i % 2 ? ('VERIFIED' as const) : ('CURATED' as const),
				authorId: author.id
			}))
		});
		await db.quote.create({
			data: {
				publicId: 'q_privat',
				text: 'A private note.',
				type: 'PRIVATE',
				status: 'PRIVATE'
			}
		});
	}, 120_000);

	afterAll(async () => {
		await storage.cleanUp();
		await resetReleaseTables(db);
		await db.disconnect();
	});

	const lines = async (key: string) =>
		Buffer.from(await storage.get(key))
			.toString('utf8')
			.split('\r\n')
			.filter(Boolean);

	it('streams all 13k rows with memory flat, never a private quote', async () => {
		// Live memory: collect garbage, then read the heap.
		const gc = (globalThis as { gc?: () => void }).gc;
		expect(gc).toBeDefined();
		const live = () => {
			gc!();
			return process.memoryUsage().heapUsed;
		};
		const before = live();
		let peak = before;
		const sample = setInterval(() => {
			peak = Math.max(peak, live());
		}, 50);
		const result = await exportQuotes(
			db,
			storage,
			'export-all',
			{ filters: {}, requestedBy },
			{ prefix }
		).finally(() => clearInterval(sample));

		expect(result).toMatchObject({
			key: `${prefix}/export-all.csv`,
			rows: ROWS
		});
		// One batch of 1000 rows is held at a time, never all 13k.
		expect(peak - before).toBeLessThan(16 * 1024 * 1024);

		const csv = await lines(result.key);
		expect(csv[0]).toBe(EXPORT_COLUMNS.join(','));
		expect(csv).toHaveLength(ROWS + 1); // the header, then a row each
		expect(csv.join('\n')).not.toContain('q_privat');
		expect(csv[1]).toBe(
			'q_000000,"Commas, ""quotes""\nand lines.",canonical,CURATED,Edsger W. Dijkstra,,,,,,,,0,0,' +
				csv[1]!.split(',').slice(-2).join(',')
		);
	}, 120_000);

	it('applies the filters', async () => {
		const result = await exportQuotes(
			db,
			storage,
			'export-curated',
			{ filters: { state: 'CURATED', q: 'quote 1' }, requestedBy },
			{ prefix }
		);
		const csv = await lines(result.key);
		expect(result.rows).toBe(csv.length - 1);
		expect(csv.slice(1).every((row) => row.includes(',CURATED,'))).toBe(true);
	});

	it('throws when the upload fails, so the job is retried', async () => {
		const failing: Storage = {
			put: (...args) => storage.put(...args),
			putFile: () => Promise.reject(new Error('storage unavailable')),
			get: (key) => storage.get(key),
			delete: (key) => storage.delete(key)
		};
		await expect(
			exportQuotes(
				db,
				failing,
				'export-failed',
				{ filters: {}, requestedBy },
				{
					prefix,
					batchSize: 5000
				}
			)
		).rejects.toThrow('storage unavailable');
	});
});
