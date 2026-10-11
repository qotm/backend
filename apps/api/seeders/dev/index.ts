import { createHash } from 'crypto';
import type { PrismaClient } from '@qotm/db/client';
import { QuoteStatus as S, QuoteType } from '@qotm/db/enums';
import { auth } from '../../src/lib/auth';
import { TRACK_STEPS, assertTransition } from '../../src/quotes/lifecycle';
import { setReaction } from '../../src/reactions/reactions';
import { CURATION_CHECKLIST } from '../../src/review/decisions';
import {
	AUTHORS,
	CORRECTIONS,
	DEV_PASSWORD,
	FAVORITES,
	LIKES,
	MATCHES,
	MEMBERS,
	QUOTES,
	RECOMMENDATIONS,
	RELEASES,
	REPORTS,
	SOURCES,
	VERIFIER,
	type DesignRole,
	type SampleQuote
} from './data';

/**
 * Loads the design's sample content for local development. Idempotent: every
 * record is found by its natural key (email, slug, public id, report number,
 * version) and skipped when it exists, so `yarn db:seed` can be re-run.
 */

// Until QOT-27 adds the design's roles, map them onto the template's.
const TEMPLATE_ROLE: Record<DesignRole, 'user' | 'admin'> = {
	member: 'user',
	verifier: 'admin',
	moderator: 'admin',
	admin: 'admin'
};

const DAY = 24 * 60 * 60 * 1000;
const START = Date.parse('2026-07-01T09:00:00Z');

type Ids = Record<string, string>;

export async function seedDevelopmentData(db: PrismaClient) {
	const users = await seedMembers(db);
	const authors = await seedAuthors(db);
	const sources = await seedSources(db, authors);
	const quotes = await seedQuotes(db, users, authors, sources);
	await seedMatches(db, quotes);
	await seedReports(db, users, quotes);
	await seedReactions(db, users, quotes);
	await seedReleases(db, users);
	await seedCorrections(db, users, quotes);
	await seedAudit(db, users);
}

async function seedMembers(db: PrismaClient): Promise<Ids> {
	const ids: Ids = {};
	for (const member of MEMBERS) {
		const email = `${member.handle}@example.com`;
		let user = await db.user.findUnique({ where: { email } });
		if (!user) {
			await auth.api.createUser({
				body: {
					name: member.name,
					email,
					password: DEV_PASSWORD,
					role: TEMPLATE_ROLE[member.role]
				}
			});
			user = await db.user.update({
				where: { email },
				data: {
					handle: member.handle,
					bio: member.bio ?? null,
					showFavorites: member.showFavorites ?? false,
					emailVerified: true
				}
			});
		}
		ids[member.handle] = user.id;
	}
	return ids;
}

async function seedAuthors(db: PrismaClient): Promise<Ids> {
	const ids: Ids = {};
	for (const { slug, ...author } of AUTHORS) {
		const row = await db.author.upsert({
			where: { slug },
			create: { slug, ...author },
			update: {}
		});
		ids[slug] = row.id;
	}
	return ids;
}

async function seedSources(db: PrismaClient, authors: Ids): Promise<Ids> {
	const ids: Ids = {};
	for (const { key, author, ...source } of SOURCES) {
		const authorId = authors[author];
		const row =
			(await db.source.findFirst({
				where: { title: source.title, authorId }
			})) ?? (await db.source.create({ data: { ...source, authorId } }));
		ids[key] = row.id;
	}
	return ids;
}

/** The statuses a sample quote passed through, from creation to now. */
function pathOf(quote: SampleQuote): S[] {
	if (quote.type === QuoteType.PRIVATE) return [S.PRIVATE];
	const steps = TRACK_STEPS[quote.type];
	const upTo = (status: S) => steps.slice(0, steps.indexOf(status) + 1);

	switch (quote.status) {
		case S.NEEDS_EVIDENCE:
		case S.REJECTED:
		case S.WITHDRAWN:
			return [S.SUBMITTED, S.UNDER_REVIEW, quote.status];
		case S.DISPUTED:
			return [...upTo(quote.beforeDispute!), S.DISPUTED];
		default:
			return upTo(quote.status);
	}
}

/** Who made each move: the contributor, the verifier, a moderator or the system. */
function actorFor(status: S, quote: SampleQuote, users: Ids) {
	switch (status) {
		case S.PRIVATE:
		case S.SUBMITTED:
			return users[quote.contributor];
		case S.UNDER_REVIEW:
		case S.VERIFIED:
		case S.NEEDS_EVIDENCE:
		case S.REJECTED:
		case S.CURATION_REVIEW:
		case S.CURATED:
			return users[VERIFIER];
		case S.DISPUTED:
		case S.WITHDRAWN:
			return users.kofi;
		default:
			return null;
	}
}

/** The review decision a move records, if it is one. */
function decisionFor(status: S) {
	switch (status) {
		case S.VERIFIED:
			return { kind: 'VERIFICATION', outcome: 'VERIFY' } as const;
		case S.NEEDS_EVIDENCE:
			return { kind: 'VERIFICATION', outcome: 'NEEDS_EVIDENCE' } as const;
		case S.REJECTED:
			return { kind: 'VERIFICATION', outcome: 'REJECT' } as const;
		case S.CURATED:
			return { kind: 'CURATION', outcome: 'CURATE' } as const;
		case S.WITHDRAWN:
			return { kind: 'MODERATION', outcome: 'WITHDRAW' } as const;
		default:
			return null;
	}
}

/** The first release a quote shipped in, which dates its DATASET_RELEASE. */
function releaseDate(publicId: string) {
	const release = RELEASES.find(
		(r) => r.state === 'PUBLISHED' && r.quotes.includes(publicId)
	);
	return release ? new Date(`${release.date}T12:00:00Z`) : null;
}

async function seedQuotes(
	db: PrismaClient,
	users: Ids,
	authors: Ids,
	sources: Ids
): Promise<Ids> {
	const ids: Ids = {};
	const topics = Object.fromEntries(
		(await db.topic.findMany({ select: { id: true, slug: true } })).map((t) => [
			t.slug,
			t.id
		])
	);

	for (const [index, quote] of QUOTES.entries()) {
		const existing = await db.quote.findUnique({
			where: { publicId: quote.publicId }
		});
		if (existing) {
			ids[quote.publicId] = existing.id;
			continue;
		}

		const path = pathOf(quote);
		// Replay the path through the lifecycle rules, so the seed can never
		// hold a history the API would refuse.
		path
			.slice(1)
			.forEach((to, i) =>
				assertTransition(quote.type, path[i], to, quote.beforeDispute)
			);

		const dates = path.map((status, i) =>
			status === S.DATASET_RELEASE
				? releaseDate(quote.publicId)!
				: new Date(START + (index + i) * DAY)
		);
		const at = (status: S) => {
			const i = path.indexOf(status);
			return i === -1 ? null : dates[i];
		};

		ids[quote.publicId] = await db.$transaction(async (tx) => {
			const row = await tx.quote.create({
				data: {
					publicId: quote.publicId,
					text: quote.text,
					type: quote.type,
					status: quote.status,
					authorId: quote.author ? authors[quote.author] : null,
					sourceId: quote.source ? sources[quote.source] : null,
					work: quote.work ?? null,
					year: quote.year ?? null,
					context: quote.context ?? null,
					contributorId: users[quote.contributor],
					verifierId: at(S.VERIFIED) ? users[VERIFIER] : null,
					verifiedAt: at(S.VERIFIED),
					publishedAt: at(S.VERIFIED) ?? at(S.PUBLISHED),
					createdAt: dates[0],
					topics: {
						create: quote.topics.map((slug) => ({ topicId: topics[slug] }))
					}
				}
			});

			for (const [i, status] of path.entries()) {
				const actorId = actorFor(status, quote, users);
				await tx.quoteEvent.create({
					data: {
						quoteId: row.id,
						fromStatus: i === 0 ? null : path[i - 1],
						toStatus: status,
						actorId,
						at: dates[i]
					}
				});
				const decision = decisionFor(status);
				if (decision) {
					await tx.reviewDecision.create({
						data: {
							...decision,
							quoteId: row.id,
							actorId,
							note: status === quote.status ? (quote.note ?? null) : null,
							checklist:
								decision.kind === 'CURATION'
									? Object.fromEntries(
											Object.keys(CURATION_CHECKLIST).map((k) => [k, true])
										)
									: undefined,
							createdAt: dates[i]
						}
					});
				}
			}
			return row.id;
		});
	}
	return ids;
}

async function seedMatches(db: PrismaClient, quotes: Ids) {
	for (const match of MATCHES) {
		const quoteId = quotes[match.quote];
		const matchedQuoteId = quotes[match.matched];
		await db.matchResult.upsert({
			where: {
				quoteId_matchedQuoteId_method: {
					quoteId,
					matchedQuoteId,
					method: match.method
				}
			},
			create: {
				quoteId,
				matchedQuoteId,
				method: match.method,
				score: match.score
			},
			update: {}
		});
	}
}

async function seedReports(db: PrismaClient, users: Ids, quotes: Ids) {
	for (const report of REPORTS) {
		if (await db.report.findUnique({ where: { number: report.number } })) {
			continue;
		}
		const created = await db.report.create({
			data: {
				number: report.number,
				quoteId: quotes[report.quote],
				reporterId: users[report.reporter],
				reason: report.reason,
				status: report.status,
				details: report.details ?? null
			}
		});
		// The moderator's decision that marked the quote disputed.
		if (report.status === 'DISPUTED') {
			await db.reviewDecision.create({
				data: {
					kind: 'MODERATION',
					outcome: 'MARK_DISPUTED',
					quoteId: created.quoteId,
					reportId: created.id,
					actorId: users.kofi,
					note: 'Looking for the original source.'
				}
			});
		}
	}
	// Explicit numbers bypass the sequence; move it past them so the next
	// real report does not collide.
	await db.$executeRaw`
		SELECT setval(pg_get_serial_sequence('reports', 'number'),
			GREATEST((SELECT MAX(number) FROM reports), 1))`;
}

async function seedReactions(db: PrismaClient, users: Ids, quotes: Ids) {
	const sets = [
		['like', LIKES],
		['favorite', FAVORITES],
		['recommend', RECOMMENDATIONS]
	] as const;
	for (const [kind, pairs] of sets) {
		for (const [handle, publicId] of pairs) {
			await setReaction(
				db,
				kind,
				{ userId: users[handle], quoteId: quotes[publicId] },
				true
			);
		}
	}
}

async function seedReleases(db: PrismaClient, users: Ids) {
	let previous: string[] = [];
	for (const release of RELEASES) {
		const added = release.quotes.filter((q) => !previous.includes(q)).length;
		const withdrawn = previous.filter(
			(q) => !release.quotes.includes(q)
		).length;
		previous = release.quotes;
		if (await db.release.findUnique({ where: { version: release.version } })) {
			continue;
		}

		const date = new Date(`${release.date}T12:00:00Z`);
		const rows = await db.quote.findMany({
			where: { publicId: { in: release.quotes } },
			select: { id: true, text: true }
		});
		await db.release.create({
			data: {
				version: release.version,
				state: release.state,
				schemaVersion: 1,
				eligibleCount: release.quotes.length,
				addedCount: added,
				correctedCount: 0,
				withdrawnCount: withdrawn,
				sizeBytes: 2_600_000 + release.quotes.length * 1_000,
				sha256: createHash('sha256').update(release.version).digest('hex'),
				artifactKey: `releases/${release.version}/qotm.sqlite`,
				manifestKey: `releases/${release.version}/manifest.json`,
				previewBuiltAt: date,
				publishedById: release.publishedBy ? users[release.publishedBy] : null,
				publishedAt: release.state === 'PUBLISHED' ? date : null,
				createdAt: date,
				quotes: {
					create: rows.map((q) => ({ quoteId: q.id, textAtRelease: q.text }))
				}
			}
		});
	}
}

async function seedCorrections(db: PrismaClient, users: Ids, quotes: Ids) {
	for (const fix of CORRECTIONS) {
		const quoteId = quotes[fix.quote];
		if (await db.correction.findFirst({ where: { quoteId } })) continue;
		const quote = await db.quote.findUniqueOrThrow({ where: { id: quoteId } });
		await db.correction.create({
			data: {
				quoteId,
				oldText: fix.oldText,
				newText: quote.text,
				actorId: users[fix.actor],
				note: fix.note
			}
		});
	}
}

/** The audit log's rows (Admin · Audit log), plus each release publish. */
interface AuditRow {
	at: string;
	actor: string;
	action: string;
	targetType: string;
	targetId: string;
	note?: string;
}

async function seedAudit(db: PrismaClient, users: Ids) {
	const rows: AuditRow[] = [
		...RELEASES.filter((r) => r.state === 'PUBLISHED').map((r) => ({
			at: `${r.date}T12:00:00Z`,
			actor: r.publishedBy!,
			action: 'release.published',
			targetType: 'release',
			targetId: r.version
		})),
		{
			at: '2026-09-22T20:11:00Z',
			actor: 'mireille',
			action: 'user.role_changed',
			targetType: 'user',
			targetId: 'kofi',
			note: 'member → moderator'
		},
		{
			at: '2026-09-24T09:30:00Z',
			actor: 'mireille',
			action: 'quote.curated',
			targetType: 'quote',
			targetId: 'q_6f1k9s'
		},
		{
			at: '2026-09-25T11:15:00Z',
			actor: 'ada',
			action: 'quote.corrected',
			targetType: 'quote',
			targetId: 'q_5k0q2j',
			note: 'Matched to the 1974 paper'
		},
		{
			at: '2026-09-26T16:40:00Z',
			actor: 'kofi',
			action: 'quote.withdrawn',
			targetType: 'quote',
			targetId: 'q_w1d7r3',
			note: 'Duplicate of q_9b5n2k'
		},
		{
			at: '2026-09-26T18:02:00Z',
			actor: 'mireille',
			action: 'release.preview_built',
			targetType: 'release',
			targetId: 'v2026.09.1'
		}
	];
	for (const { at, actor, note, ...row } of rows) {
		const exists = await db.auditLog.findFirst({
			where: { action: row.action, targetId: row.targetId }
		});
		if (exists) continue;
		await db.auditLog.create({
			data: {
				...row,
				actorId: users[actor],
				actorHandle: actor,
				note: note ?? null,
				at: new Date(at)
			}
		});
	}
}
