import { rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA, SCHEMA_VERSION } from './schema.js';

export interface DatasetAuthor {
	slug: string;
	name: string;
	bornYear: number | null;
	diedYear: number | null;
	description: string | null;
}

export interface DatasetQuote {
	/** The public id, `q_8f2k1c`. */
	id: string;
	text: string;
	type: 'canonical' | 'original';
	/** The author's slug; null for an original. */
	author: string | null;
	work: string | null;
	year: number | null;
	source: string | null;
	sourceUrl: string | null;
	/** The contributor's handle; null once their account is gone. */
	contributor: string | null;
	/** Topic slugs. */
	topics: string[];
}

export interface Dataset {
	version: string;
	builtAt: Date;
	authors: DatasetAuthor[];
	topics: { slug: string; name: string }[];
	quotes: DatasetQuote[];
}

/**
 * Writes `dataset` to a new `qotm.sqlite` at `file` (replacing any file
 * there). Rows go in sorted by slug and public id, so the same content
 * builds the same tables. Returns the file's quote count.
 */
export function writeDataset(file: string, dataset: Dataset) {
	rmSync(file, { force: true });
	const db = new DatabaseSync(file);
	try {
		db.exec('PRAGMA journal_mode = DELETE; PRAGMA foreign_keys = ON;');
		db.exec(SCHEMA);
		db.exec('BEGIN');

		const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
		meta.run('version', dataset.version);
		meta.run('schemaVersion', String(SCHEMA_VERSION));
		meta.run('builtAt', dataset.builtAt.toISOString());

		const authorIds = new Map<string, number>();
		const authors = new Map<string, DatasetAuthor>();
		const insertAuthor = db.prepare(
			'INSERT INTO authors (slug, name, born_year, died_year, description) VALUES (?, ?, ?, ?, ?)'
		);
		for (const a of bySlug(dataset.authors)) {
			const { lastInsertRowid } = insertAuthor.run(
				a.slug,
				a.name,
				a.bornYear,
				a.diedYear,
				a.description
			);
			authorIds.set(a.slug, Number(lastInsertRowid));
			authors.set(a.slug, a);
		}

		const topicIds = new Map<string, number>();
		const insertTopic = db.prepare(
			'INSERT INTO topics (slug, name) VALUES (?, ?)'
		);
		for (const t of bySlug(dataset.topics)) {
			const { lastInsertRowid } = insertTopic.run(t.slug, t.name);
			topicIds.set(t.slug, Number(lastInsertRowid));
		}

		const insertQuote = db.prepare(
			`INSERT INTO quotes (id, text, type, author_id, author, author_slug,
				work, year, source, source_url, contributor)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);
		const insertTopicLink = db.prepare(
			'INSERT INTO quote_topics (quote_id, topic_id) VALUES (?, ?)'
		);
		const quotes = [...dataset.quotes].sort((a, b) =>
			a.id < b.id ? -1 : a.id > b.id ? 1 : 0
		);
		for (const q of quotes) {
			const author = q.author ? authors.get(q.author) : undefined;
			if (q.author && !author) {
				throw new Error(`Quote ${q.id}: unknown author ${q.author}`);
			}
			insertQuote.run(
				q.id,
				q.text,
				q.type,
				author ? authorIds.get(author.slug)! : null,
				author?.name ?? null,
				author?.slug ?? null,
				q.work,
				q.year,
				q.source,
				q.sourceUrl,
				q.contributor
			);
			for (const slug of [...new Set(q.topics)].sort()) {
				const topicId = topicIds.get(slug);
				if (topicId === undefined) {
					throw new Error(`Quote ${q.id}: unknown topic ${slug}`);
				}
				insertTopicLink.run(q.id, topicId);
			}
		}

		db.exec("INSERT INTO quotes_fts (quotes_fts) VALUES ('rebuild')");
		db.exec('COMMIT');
		db.exec("INSERT INTO quotes_fts (quotes_fts) VALUES ('optimize')");
		db.exec('VACUUM');
		return quotes.length;
	} finally {
		db.close();
	}
}

function bySlug<T extends { slug: string }>(rows: T[]) {
	return [...rows].sort((a, b) =>
		a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0
	);
}
