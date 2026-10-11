import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
	SCHEMA_VERSION,
	TABLES,
	loadDataset,
	writeDataset,
	type Dataset
} from './index.js';

const dir = mkdtempSync(join(tmpdir(), 'qotm-dataset-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const DATASET: Dataset = {
	version: 'v2026.09.1',
	builtAt: new Date('2026-09-26T18:02:00.000Z'),
	authors: [
		{
			slug: 'kernighan',
			name: 'Brian W. Kernighan & P. J. Plauger',
			bornYear: null,
			diedYear: null,
			description: null
		},
		{
			slug: 'dijkstra',
			name: 'Edsger W. Dijkstra',
			bornYear: 1930,
			diedYear: 2002,
			description: 'computer scientist'
		}
	],
	topics: [
		{ slug: 'complexity', name: 'complexity' },
		{ slug: 'software-design', name: 'software design' }
	],
	quotes: [
		{
			id: 'q_6f1k9s',
			text: 'Controlling complexity is the essence of computer programming.',
			type: 'canonical',
			author: 'kernighan',
			work: 'Software Tools',
			year: 1976,
			source: 'Software Tools',
			sourceUrl: null,
			contributor: 'ada',
			topics: ['complexity']
		},
		{
			id: 'q_8f2k1c',
			text: 'Simplicity is prerequisite for reliability.',
			type: 'canonical',
			author: 'dijkstra',
			work: 'EWD 498',
			year: 1975,
			source: 'EWD 498: How do we tell truths that might hurt?',
			sourceUrl: 'https://www.cs.utexas.edu/~EWD/',
			contributor: null,
			topics: ['software-design', 'complexity']
		},
		{
			id: 'q_4r8y1p',
			text: 'A green build is a hypothesis, not a proof.',
			type: 'original',
			author: null,
			work: null,
			year: null,
			source: null,
			sourceUrl: null,
			contributor: 'ada',
			topics: []
		}
	]
};

function build(name: string, dataset = DATASET) {
	const file = join(dir, name);
	writeDataset(file, dataset);
	return new DatabaseSync(file, { readOnly: true });
}

describe('writeDataset', () => {
	const db = build('qotm.sqlite');

	it('writes schema version 1, in the pragma and in meta', () => {
		expect(db.prepare('PRAGMA user_version').get()).toEqual({
			user_version: SCHEMA_VERSION
		});
		const meta = Object.fromEntries(
			db
				.prepare('SELECT key, value FROM meta')
				.all()
				.map((r) => [r.key, r.value])
		);
		expect(meta).toEqual({
			version: 'v2026.09.1',
			schemaVersion: '1',
			builtAt: '2026-09-26T18:02:00.000Z'
		});
	});

	it('holds the v1 tables and nothing else', () => {
		const tables = db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'quotes_fts_%' ORDER BY name"
			)
			.all()
			.map((r) => r.name);
		expect(tables).toEqual([...TABLES]);
	});

	it('finds quotes through the FTS index, stemmed and by author', () => {
		const search = (match: string) =>
			db
				.prepare(
					'SELECT q.id FROM quotes_fts f JOIN quotes q ON q.n = f.rowid WHERE quotes_fts MATCH ? ORDER BY rank'
				)
				.all(match)
				.map((r) => r.id);
		expect(search('complex')).toEqual(['q_6f1k9s']);
		expect(search('dijkstra')).toEqual(['q_8f2k1c']);
		expect(search('proofs')).toEqual(['q_4r8y1p']);
	});

	it('links authors and topics', () => {
		expect(
			db
				.prepare(
					"SELECT q.author, q.author_slug, a.born_year FROM quotes q JOIN authors a ON a.id = q.author_id WHERE q.id = 'q_8f2k1c'"
				)
				.get()
		).toEqual({
			author: 'Edsger W. Dijkstra',
			author_slug: 'dijkstra',
			born_year: 1930
		});
		expect(
			db
				.prepare(
					"SELECT t.slug FROM quote_topics qt JOIN topics t ON t.id = qt.topic_id WHERE qt.quote_id = 'q_8f2k1c' ORDER BY t.slug"
				)
				.all()
				.map((r) => r.slug)
		).toEqual(['complexity', 'software-design']);
		expect(
			db
				.prepare("SELECT author, contributor FROM quotes WHERE id = 'q_4r8y1p'")
				.get()
		).toEqual({ author: null, contributor: 'ada' });
	});

	it('refuses a quote whose author or topic is missing', () => {
		const broken = {
			...DATASET,
			quotes: [{ ...DATASET.quotes[2]!, topics: ['astrology'] }]
		};
		expect(() => writeDataset(join(dir, 'broken.sqlite'), broken)).toThrow(
			/unknown topic astrology/
		);
	});
});

describe('loadDataset', () => {
	const row = {
		publicId: 'q_8f2k1c',
		text: 'Simplicity is prerequisite for reliability.',
		type: 'CANONICAL',
		work: 'EWD 498',
		year: 1975,
		sourceUrl: null,
		author: DATASET.authors[1],
		source: { title: 'EWD 498', url: 'https://www.cs.utexas.edu/~EWD/' },
		contributor: { handle: 'kofi' },
		topics: [{ topic: { slug: 'complexity', name: 'complexity' } }]
	};

	it('reads only eligible, non-private quotes, and selects no account data', async () => {
		const findMany = vi.fn().mockResolvedValue([row]);
		const dataset = await loadDataset(
			{ quote: { findMany } } as never,
			'v2026.09.1',
			DATASET.builtAt
		);
		const args = findMany.mock.calls[0]![0];
		expect(args.where).toEqual({
			status: { in: ['CURATED', 'DATASET_RELEASE'] },
			type: { in: ['CANONICAL', 'ORIGINAL'] }
		});
		const selected = JSON.stringify(args.select);
		for (const field of ['email', 'id"', 'role', 'reports', 'events']) {
			expect(selected).not.toContain(field);
		}
		expect(dataset.quotes[0]).toEqual({
			id: 'q_8f2k1c',
			text: row.text,
			type: 'canonical',
			author: 'dijkstra',
			work: 'EWD 498',
			year: 1975,
			source: 'EWD 498',
			sourceUrl: 'https://www.cs.utexas.edu/~EWD/',
			contributor: 'kofi',
			topics: ['complexity']
		});
		expect(dataset.authors).toEqual([DATASET.authors[1]]);
	});
});
