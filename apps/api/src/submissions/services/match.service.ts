import { Injectable } from '@nestjs/common';
import { PrismaService } from 'common/services';
import { NOT_PUBLIC } from 'quotes/visibility';
import type { MatchEntity } from '../entity';

/** Below this, the words are too few to compare meaningfully. */
const MIN_LENGTH = 12;

/**
 * Lower case, accents dropped, letters and digits only, single spaces: two
 * quotes are an
 * exact match when these are equal ("Make it work, make it right!" equals
 * "make it work make it right").
 */
export function normalize(text: string) {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

/**
 * The closest public quote to some text, for the submit form's live check and
 * the originality job. Uses pg_trgm through the trigram index on
 * `quotes.text`:
 *
 * `word_similarity(text, quotes.text)` (the `<%` operator, at pg_trgm's 0.6
 * threshold) finds the typed words inside a longer quote ("premature
 * optimization is the root of all evil" inside Knuth's full sentence) as well
 * as a near-identical whole quote. Plain `similarity` is not used: at its 0.3
 * threshold the index returns most of the corpus to recheck.
 *
 * Only public quotes take part, so the check never reveals someone's private
 * quote or unreviewed submission. A match flags for review; it never decides
 * authorship.
 */
@Injectable()
export class MatchService {
	constructor(private db: PrismaService) {}

	async match(text: string, exclude?: string): Promise<MatchEntity> {
		const none: MatchEntity = { match: null, method: null, score: null };
		const typed = text.trim();
		if (typed.length < MIN_LENGTH) return none;

		// The candidates come from the trigram index alone (a materialised CTE,
		// so the planner cannot drive the query from another index and filter
		// every row instead). It also underrates word_similarity's per-row cost
		// and would scan the table, ~170 ms on 13k quotes against a few through
		// the index, so seq scans are off for this one statement (SET LOCAL
		// ends with the transaction).
		const [, rows] = await this.db.$transaction([
			this.db.$executeRaw`SET LOCAL enable_seqscan = off`,
			this.db.$queryRaw<
				{
					public_id: string;
					text: string;
					author: string | null;
					score: number;
				}[]
			>`
				WITH candidates AS MATERIALIZED (
					SELECT id, public_id, text, attribution, author_id, status,
						word_similarity(${typed}, text) AS score
					FROM quotes
					WHERE ${typed} <% text
				)
				SELECT c.public_id, c.text, COALESCE(a.name, c.attribution) AS author, c.score
				FROM candidates c
				LEFT JOIN authors a ON a.id = c.author_id
				WHERE c.status::text <> ALL(${[...NOT_PUBLIC]}::text[])
					AND (${exclude ?? null}::text IS NULL OR c.public_id <> ${exclude ?? null})
				ORDER BY c.score DESC, c.public_id
				LIMIT 1`
		]);
		const [best] = rows;
		if (!best) return none;

		const exact = normalize(best.text) === normalize(typed);
		return {
			match: { id: best.public_id, text: best.text, author: best.author },
			method: exact ? 'exact' : 'fuzzy',
			score: exact ? 1 : Math.round(Number(best.score) * 100) / 100
		};
	}
}
