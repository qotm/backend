import type { PrismaClient } from '@qotm/db/client';

/**
 * The originality check (BUILD-PLAN §6, QOT-13): compare an original against
 * the public corpus with pg_trgm, record each possible match, and publish the
 * original only when nothing is close. A match waits for a moderator; it never
 * decides authorship.
 */

type Db = Pick<PrismaClient, '$transaction'>;
type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** pg_trgm's default word_similarity threshold, as the `<%` operator uses. */
export const MATCH_THRESHOLD = 0.6;
const MAX_MATCHES = 5;

/**
 * Statuses the corpus leaves out: the same set the API keeps from the public
 * (`apps/api/src/quotes/visibility.ts`, NOT_PUBLIC). Keep the two in step.
 */
const NOT_PUBLIC = [
	'PRIVATE',
	'SUBMITTED',
	'ORIGINALITY_CHECK',
	'REJECTED',
	'WITHDRAWN'
];

export interface Match {
	matchedQuoteId: string;
	method: 'EXACT' | 'FUZZY';
	score: number;
}

/** Lower case, accents dropped, letters and digits only (as the API's normalize). */
export function normalize(text: string) {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

/**
 * The closest public quotes to `text`, best first. Candidates come from the
 * trigram index (a materialised CTE, seq scans off for the statement): the
 * planner otherwise scans the table, ~170 ms on 13k quotes.
 */
export async function findMatches(
	tx: Tx,
	quote: { id: string; text: string }
): Promise<Match[]> {
	await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
	const rows = await tx.$queryRaw<
		{ id: string; text: string; score: number }[]
	>`
		WITH candidates AS MATERIALIZED (
			SELECT id, text, status, word_similarity(${quote.text}, text) AS score
			FROM quotes
			WHERE ${quote.text} <% text
		)
		SELECT id, text, score FROM candidates
		WHERE id <> ${quote.id}
			AND status::text <> ALL(${NOT_PUBLIC}::text[])
		ORDER BY score DESC, id
		LIMIT ${MAX_MATCHES}`;
	const typed = normalize(quote.text);
	return rows.map((row) => {
		const exact = normalize(row.text) === typed;
		return {
			matchedQuoteId: row.id,
			method: exact ? 'EXACT' : 'FUZZY',
			score: exact ? 1 : Math.round(Number(row.score) * 100) / 100
		};
	});
}

async function record(tx: Tx, quoteId: string, matches: Match[]) {
	for (const match of matches) {
		await tx.matchResult.upsert({
			where: {
				quoteId_matchedQuoteId_method: {
					quoteId,
					matchedQuoteId: match.matchedQuoteId,
					method: match.method
				}
			},
			create: { quoteId, ...match },
			update: { score: match.score }
		});
	}
}

export type CheckOutcome =
	| { outcome: 'skipped'; reason: string }
	| { outcome: 'published'; publicId: string }
	| { outcome: 'held'; matches: Match[] };

/**
 * Checks one submitted original. Safe to run twice: a quote no longer in the
 * originality check is skipped, and the publish is a conditional update.
 */
export function checkOriginality(
	db: Db,
	quoteId: string
): Promise<CheckOutcome> {
	return db.$transaction(async (tx) => {
		const quote = await tx.quote.findUnique({
			where: { id: quoteId },
			select: { id: true, publicId: true, text: true, type: true, status: true }
		});
		if (!quote) return { outcome: 'skipped', reason: 'quote not found' };
		if (quote.type !== 'ORIGINAL' || quote.status !== 'ORIGINALITY_CHECK') {
			return { outcome: 'skipped', reason: `quote is ${quote.status}` };
		}

		const matches = await findMatches(tx, quote);
		if (matches.length) {
			// Possible match: it waits in the submissions queue for a moderator.
			await record(tx, quote.id, matches);
			return { outcome: 'held', matches };
		}

		const now = new Date();
		const { count } = await tx.quote.updateMany({
			where: { id: quote.id, status: 'ORIGINALITY_CHECK' },
			data: { status: 'PUBLISHED', publishedAt: now }
		});
		if (count === 0)
			return { outcome: 'skipped', reason: 'quote changed meanwhile' };
		await tx.quoteEvent.create({
			data: {
				quoteId: quote.id,
				fromStatus: 'ORIGINALITY_CHECK',
				toStatus: 'PUBLISHED',
				actorId: null,
				note: 'No known matching attribution found.',
				at: now
			}
		});
		return { outcome: 'published', publicId: quote.publicId };
	});
}

/**
 * The nightly re-check: published originals against a corpus that has grown
 * since. Records new possible matches for moderators; never unpublishes.
 */
export async function recheckOriginals(db: Db & Pick<PrismaClient, 'quote'>) {
	const originals = await db.quote.findMany({
		where: { type: 'ORIGINAL', status: { notIn: NOT_PUBLIC as never } },
		select: { id: true, text: true }
	});
	let flagged = 0;
	for (const quote of originals) {
		const matches = await db.$transaction(async (tx) => {
			const found = await findMatches(tx, quote);
			await record(tx, quote.id, found);
			return found;
		});
		if (matches.length) flagged++;
	}
	return { checked: originals.length, flagged };
}
