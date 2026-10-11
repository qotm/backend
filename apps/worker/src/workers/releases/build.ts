import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UnrecoverableError } from 'bullmq';
import { Prisma, type PrismaClient } from '@qotm/db/client';
import {
	SCHEMA_VERSION,
	loadDataset,
	writeDataset
} from '#app/dataset/index.js';
import { IMMUTABLE, type Storage } from '#lib/storage.js';
import { DATASET_FILE, MANIFEST_FILE, datasetUrl, previewDir } from './keys.js';

/** Who asked for the job, as the audit log records them; null: the system. */
export type Actor = { id: string; handle: string } | null;

export interface ReleaseJob {
	releaseId: string;
	actor: Actor;
}

export interface ReleaseOptions {
	prefix: string;
	baseUrl: string;
	now?: Date;
}

export interface Changes {
	eligible: number;
	added: number;
	corrected: number;
	withdrawn: number;
}

/** The manifest the CLI reads (BUILD-PLAN §5, "Sync"). */
export interface Manifest {
	version: string;
	schemaVersion: number;
	publishedAt: string | null;
	url: string;
	size: number;
	sha256: string;
	changes: Changes;
}

/**
 * The diff against the last published release, by public id: added (new
 * ids), corrected (same id, different text) and withdrawn (gone).
 */
export function diffReleases(
	previous: Map<string, string>,
	next: Map<string, string>
): Changes {
	let added = 0;
	let corrected = 0;
	for (const [id, text] of next) {
		const before = previous.get(id);
		if (before === undefined) added++;
		else if (before !== text) corrected++;
	}
	let withdrawn = 0;
	for (const id of previous.keys()) if (!next.has(id)) withdrawn++;
	return { eligible: next.size, added, corrected, withdrawn };
}

/** The audit note and Releases screen summary: "+74 ~9 −4". */
export const changeNote = (c: Changes) =>
	`+${c.added} ~${c.corrected} −${c.withdrawn}`;

const READ_COMMITTED = {
	isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
};

/**
 * Builds a release's preview (BUILD-PLAN §6, QOT-50): compiles the eligible
 * quotes into `qotm.sqlite`, writes its manifest, uploads both, and records
 * the preview: counts, size, sha256, keys, the quotes with their text as
 * shipped, state PREVIEW, and an audit row, in one transaction.
 *
 * A published release is never rebuilt: the job fails without retrying.
 * Rebuilding a preview replaces it. Uploads come first and are
 * content-addressed, so a failure part-way leaves the release as it was.
 */
export async function buildPreview(
	db: PrismaClient,
	storage: Storage,
	job: ReleaseJob,
	options: ReleaseOptions
) {
	const now = options.now ?? new Date();
	const release = await db.release.findUnique({
		where: { id: job.releaseId }
	});
	if (!release) {
		throw new UnrecoverableError(`Release ${job.releaseId} not found`);
	}
	if (release.state === 'PUBLISHED') {
		throw new UnrecoverableError(
			`Release ${release.version} is published and is never rebuilt`
		);
	}

	const dataset = await loadDataset(db, release.version, now);
	const next = new Map(dataset.quotes.map((q) => [q.id, q.text]));
	const changes = diffReleases(await lastPublished(db, release.id), next);

	const dir = mkdtempSync(join(tmpdir(), 'qotm-release-'));
	try {
		const file = join(dir, DATASET_FILE);
		writeDataset(file, dataset);
		const bytes = readFileSync(file);
		const sha256 = createHash('sha256').update(bytes).digest('hex');
		const manifest: Manifest = {
			version: release.version,
			schemaVersion: SCHEMA_VERSION,
			publishedAt: null,
			url: datasetUrl(options.baseUrl, release.version),
			size: bytes.length,
			sha256,
			changes
		};

		const base = previewDir(options.prefix, release.version, sha256);
		const artifactKey = `${base}/${DATASET_FILE}`;
		const manifestKey = `${base}/${MANIFEST_FILE}`;
		await storage.put(artifactKey, bytes, {
			contentType: 'application/vnd.sqlite3',
			cacheControl: IMMUTABLE
		});
		await storage.put(manifestKey, JSON.stringify(manifest, null, 2), {
			contentType: 'application/json',
			cacheControl: 'no-cache'
		});

		const quoteIds = await db.quote.findMany({
			where: { publicId: { in: [...next.keys()] } },
			select: { id: true, publicId: true }
		});
		await db.$transaction(async (tx) => {
			// The row lock orders this against a publish: whichever commits
			// first wins, and a published release is left alone.
			const [locked] = await tx.$queryRaw<{ state: string }[]>`
				SELECT state FROM releases WHERE id = ${release.id} FOR UPDATE`;
			if (!locked || locked.state === 'PUBLISHED') {
				throw new UnrecoverableError(
					`Release ${release.version} was published while it was being built`
				);
			}
			await tx.releaseQuote.deleteMany({ where: { releaseId: release.id } });
			await tx.releaseQuote.createMany({
				data: quoteIds.map((q) => ({
					releaseId: release.id,
					quoteId: q.id,
					textAtRelease: next.get(q.publicId)!
				}))
			});
			await tx.release.update({
				where: { id: release.id },
				data: {
					state: 'PREVIEW',
					schemaVersion: SCHEMA_VERSION,
					eligibleCount: changes.eligible,
					addedCount: changes.added,
					correctedCount: changes.corrected,
					withdrawnCount: changes.withdrawn,
					sizeBytes: bytes.length,
					sha256,
					artifactKey,
					manifestKey,
					previewBuiltAt: now
				}
			});
			// The actor's account may have gone since they asked: keep their
			// handle, drop the link (as a deleted account's rows do).
			const actorId = job.actor
				? ((
						await tx.user.findUnique({
							where: { id: job.actor.id },
							select: { id: true }
						})
					)?.id ?? null)
				: null;
			await tx.auditLog.create({
				data: {
					actorId,
					actorHandle: job.actor?.handle ?? null,
					action: 'release.preview_built',
					targetType: 'release',
					targetId: release.version,
					note: changeNote(changes)
				}
			});
		}, READ_COMMITTED);

		return { version: release.version, sha256, size: bytes.length, changes };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/** The last published release's quotes: public id → text as shipped. */
async function lastPublished(db: PrismaClient, exclude: string) {
	const release = await db.release.findFirst({
		where: { state: 'PUBLISHED', id: { not: exclude } },
		orderBy: { publishedAt: 'desc' },
		select: {
			quotes: {
				select: { textAtRelease: true, quote: { select: { publicId: true } } }
			}
		}
	});
	return new Map(
		(release?.quotes ?? []).map((q) => [q.quote.publicId, q.textAtRelease])
	);
}
