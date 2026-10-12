import 'dotenv/config';
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@qotm/db/client';
import { QuoteStatus as S, QuoteType, SourceKind } from '@qotm/db/enums';
import { auth } from '../src/lib/auth';
import { recordAudit } from '../src/audit/audit';
import { assertTransition } from '../src/quotes/lifecycle';
import { withPublicId } from '../src/quotes/public-id';
import { CURATION_CHECKLIST } from '../src/review/decisions';

/**
 * Imports the quote corpus (the qotm corpus repo's `out/import.json`):
 *
 *   yarn db:import ../../../corpus/out/import.json        # dev
 *   yarn test:db:import ../../../corpus/out/import.json   # test database
 *
 * Every quote is canonical and credited to the "qotm" import account, a
 * banned admin nobody can sign in as. Tier A (a primary, dated, located
 * source) is verified on import; tier B waits in the verification queue; a
 * quote marked `curate` (tier A only) is then curated for the next release.
 * Each move is a QuoteEvent with the evidence in its note, plus the review
 * decision and audit row the review service would write.
 *
 * Idempotent: a quote whose author already has the same text is skipped, and
 * authors, sources and topics are matched before they are created.
 */

export interface CorpusFile {
	topics: { slug: string; name: string; description: string | null }[];
	quotes: CorpusQuote[];
}

export interface CorpusQuote {
	key: string;
	text: string;
	tier: 'A' | 'B';
	curate: boolean;
	author: {
		name: string;
		slug: string;
		born: number | null;
		died: number | null;
		description: string | null;
	};
	source: {
		title: string;
		kind: SourceKind;
		year: number | null;
		url: string | null;
	} | null;
	work: string | null;
	year: number | null;
	sourceUrl: string | null;
	context: string | null;
	topics: string[];
	/** Why it is believed, for the verification note: source, locator, Wikiquote revision. */
	evidence: string;
}

const IMPORTER = {
	email: 'import@qotm.dev',
	name: 'qotm import',
	handle: 'qotm'
};

const db = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

const surname = (name: string) =>
	name
		.toLowerCase()
		.replace(/\(.*?\)/g, '')
		.split(/\s+/)
		.filter(Boolean)
		.pop() ?? '';

async function importer() {
	let user = await db.user.findUnique({ where: { email: IMPORTER.email } });
	if (!user) {
		await auth.api.createUser({
			body: {
				name: IMPORTER.name,
				email: IMPORTER.email,
				password: randomBytes(24).toString('base64url'),
				role: 'admin'
			}
		});
		user = await db.user.update({
			where: { email: IMPORTER.email },
			data: {
				handle: IMPORTER.handle,
				emailVerified: true,
				banned: true,
				banReason: 'The corpus import account; nobody signs in as it.',
				emailOnReview: false
			}
		});
	}
	return { id: user.id, handle: user.handle ?? IMPORTER.handle };
}

async function topicIds(file: CorpusFile) {
	for (const t of file.topics) {
		const existing = await db.topic.findFirst({
			where: { OR: [{ slug: t.slug }, { name: t.name }] }
		});
		if (!existing) await db.topic.create({ data: t });
	}
	const rows = await db.topic.findMany({ select: { id: true, slug: true } });
	return new Map(rows.map((r) => [r.slug, r.id]));
}

/** An existing author with this slug, name, or surname and birth year; else a new one. */
async function authorId(a: CorpusQuote['author'], cache: Map<string, string>) {
	const hit = cache.get(a.slug);
	if (hit) return hit;
	const candidates = await db.author.findMany({
		where: {
			OR: [
				{ slug: a.slug },
				{ name: { equals: a.name, mode: 'insensitive' } },
				{ name: { endsWith: a.name.split(' ').pop()!, mode: 'insensitive' } }
			]
		}
	});
	const match =
		candidates.find(
			(c) => c.slug === a.slug || c.name.toLowerCase() === a.name.toLowerCase()
		) ??
		candidates.find(
			(c) =>
				surname(c.name) === surname(a.name) &&
				c.bornYear != null &&
				c.bornYear === a.born
		);
	const id =
		match?.id ??
		(
			await db.author.create({
				data: {
					name: a.name.slice(0, 160),
					slug: a.slug,
					bornYear: a.born,
					diedYear: a.died,
					description: a.description?.slice(0, 80) ?? null
				}
			})
		).id;
	cache.set(a.slug, id);
	return id;
}

async function sourceId(
	s: NonNullable<CorpusQuote['source']>,
	authorId: string
) {
	const title = s.title.slice(0, 300);
	const existing = await db.source.findFirst({ where: { title, authorId } });
	if (existing) return existing.id;
	return (
		await db.source.create({
			data: {
				title,
				authorId,
				kind: s.kind,
				year: s.year,
				url: s.url?.slice(0, 2048) ?? null
			}
		})
	).id;
}

/** The moves an imported quote makes, by tier and curation. */
function pathOf(q: CorpusQuote): S[] {
	if (q.tier === 'B') return [S.SUBMITTED, S.UNDER_REVIEW];
	const verified = [S.SUBMITTED, S.UNDER_REVIEW, S.VERIFIED];
	return q.curate ? [...verified, S.CURATION_REVIEW, S.CURATED] : verified;
}

async function importQuote(
	q: CorpusQuote,
	actor: { id: string; handle: string },
	topics: Map<string, string>,
	authors: Map<string, string>
): Promise<'created' | 'exists'> {
	const author = await authorId(q.author, authors);
	if (await db.quote.findFirst({ where: { authorId: author, text: q.text } }))
		return 'exists';
	const source = q.source ? await sourceId(q.source, author) : null;
	const path = pathOf(q);
	path
		.slice(1)
		.forEach((to, i) => assertTransition(QuoteType.CANONICAL, path[i], to));
	const now = new Date();
	const verified = path.includes(S.VERIFIED);

	await withPublicId((publicId) =>
		db.$transaction(async (tx: Prisma.TransactionClient) => {
			const row = await tx.quote.create({
				data: {
					publicId,
					text: q.text,
					type: QuoteType.CANONICAL,
					status: path[path.length - 1],
					authorId: author,
					sourceId: source,
					work: q.work?.slice(0, 300) ?? null,
					year: q.year,
					sourceUrl: q.sourceUrl?.slice(0, 2048) ?? null,
					context: q.context?.slice(0, 1000) ?? null,
					contributorId: actor.id,
					verifierId: verified ? actor.id : null,
					verifiedAt: verified ? now : null,
					publishedAt: verified ? now : null,
					topics: {
						create: [...new Set(q.topics)]
							.filter((slug) => topics.has(slug))
							.map((slug) => ({ topicId: topics.get(slug)! }))
					}
				}
			});
			for (const [i, status] of path.entries()) {
				const note =
					status === S.SUBMITTED
						? 'Imported from the qotm corpus.'
						: status === S.VERIFIED
							? `Verified on import. ${q.evidence}`.slice(0, 1000)
							: status === S.UNDER_REVIEW && q.tier === 'B'
								? `Needs a verifier. ${q.evidence}`.slice(0, 1000)
								: status === S.CURATED
									? 'Picked for the first dataset release.'
									: null;
				await tx.quoteEvent.create({
					data: {
						quoteId: row.id,
						fromStatus: i === 0 ? null : path[i - 1],
						toStatus: status,
						actorId: actor.id,
						note,
						// A millisecond apart, so the history reads in order.
						at: new Date(now.getTime() + i)
					}
				});
				if (status === S.VERIFIED) {
					await tx.reviewDecision.create({
						data: {
							kind: 'VERIFICATION',
							outcome: 'VERIFY',
							quoteId: row.id,
							actorId: actor.id,
							note
						}
					});
					await recordAudit(tx, {
						actor,
						action: 'quote.verified',
						target: { type: 'quote', id: publicId },
						note
					});
				}
				if (status === S.CURATED) {
					await tx.reviewDecision.create({
						data: {
							kind: 'CURATION',
							outcome: 'CURATE',
							quoteId: row.id,
							actorId: actor.id,
							note,
							checklist: Object.fromEntries(
								Object.keys(CURATION_CHECKLIST).map((k) => [k, true])
							)
						}
					});
					await recordAudit(tx, {
						actor,
						action: 'quote.curated',
						target: { type: 'quote', id: publicId },
						note
					});
				}
			}
		})
	);
	return 'created';
}

async function main() {
	const file = process.argv[2];
	if (!file) throw new Error('Usage: yarn db:import <corpus out/import.json>');
	const corpus = JSON.parse(readFileSync(file, 'utf8')) as CorpusFile;
	const actor = await importer();
	const topics = await topicIds(corpus);
	const authors = new Map<string, string>();
	const counts = { created: 0, exists: 0, failed: 0 };
	for (const [i, q] of corpus.quotes.entries()) {
		try {
			counts[await importQuote(q, actor, topics, authors)]++;
		} catch (error) {
			counts.failed++;
			console.error(`${q.key} (${q.author.name}): ${(error as Error).message}`);
		}
		if ((i + 1) % 250 === 0) console.log(`${i + 1}/${corpus.quotes.length}`);
	}
	console.log(
		`${counts.created} imported, ${counts.exists} already there, ${counts.failed} failed (of ${corpus.quotes.length})`
	);
	if (counts.failed) process.exitCode = 1;
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => db.$disconnect());
