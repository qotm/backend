import { createHash } from 'node:crypto';
import { UnrecoverableError } from 'bullmq';
import type { PrismaClient } from '@qotm/db/client';
import { IMMUTABLE, type Storage } from '#lib/storage.js';
import {
	READ_COMMITTED,
	actorIdOf,
	changeNote,
	type Manifest,
	type ReleaseJob,
	type ReleaseOptions
} from './build.js';
import { DATASET_FILE, MANIFEST_FILE, datasetUrl, releaseDir } from './keys.js';

/**
 * Publishes a built preview (BUILD-PLAN §6, QOT-58): copies its file to the
 * version's permanent path, then in one transaction freezes the release
 * (PUBLISHED, publisher and time), moves its curated quotes to
 * DATASET_RELEASE with their lifecycle events, and audits it; finally writes
 * the version's manifest from the recorded values. The API's manifest
 * endpoint then serves the new version.
 *
 * Idempotent, so a retry after a crash finishes the publish rather than
 * repeating it: the copy is of identical bytes, the transaction runs only
 * while the release is still a PREVIEW (the row is locked, so a concurrent
 * delivery waits and then skips it), and the manifest is rebuilt from the
 * database, so a rewrite is byte-for-byte the same.
 *
 * Refused for good (no retry): no such release, no built preview, or a
 * preview gone stale (a quote in it has since left the eligible set, so the
 * file would ship it; rebuild the preview first).
 */
export async function publishRelease(
	db: PrismaClient,
	storage: Storage,
	job: ReleaseJob,
	options: ReleaseOptions
) {
	const release = await db.release.findUnique({
		where: { id: job.releaseId }
	});
	if (!release) {
		throw new UnrecoverableError(`Release ${job.releaseId} not found`);
	}
	if (release.state !== 'PUBLISHED') {
		if (
			release.state !== 'PREVIEW' ||
			!release.sha256 ||
			!release.artifactKey
		) {
			throw new UnrecoverableError(
				`Release ${release.version} has no built preview to publish`
			);
		}
		const stale = await db.releaseQuote.count({
			where: {
				releaseId: release.id,
				quote: { status: { notIn: ['CURATED', 'DATASET_RELEASE'] } }
			}
		});
		if (stale) {
			throw new UnrecoverableError(
				`Release ${release.version}'s preview is stale: ${stale} of its quotes are no longer eligible; rebuild it`
			);
		}
	}

	const dir = releaseDir(options.prefix, release.version);
	const artifactKey = `${dir}/${DATASET_FILE}`;
	const manifestKey = `${dir}/${MANIFEST_FILE}`;
	// From the preview, unless an earlier attempt already moved it. Read and
	// rewritten rather than copied server-side, so the bytes are checked
	// against the recorded sha256 on the way (and not every S3-compatible
	// store replaces headers on a copy).
	if (release.artifactKey !== artifactKey) {
		const bytes = await storage.get(release.artifactKey!);
		const sha256 = createHash('sha256').update(bytes).digest('hex');
		if (sha256 !== release.sha256) {
			throw new UnrecoverableError(
				`Release ${release.version}'s preview file does not match its sha256; rebuild it`
			);
		}
		await storage.put(artifactKey, bytes, {
			contentType: 'application/vnd.sqlite3',
			cacheControl: IMMUTABLE,
			public: true
		});
	}

	let published = false;
	await db.$transaction(async (tx) => {
		const [locked] = await tx.$queryRaw<{ state: string }[]>`
			SELECT state FROM releases WHERE id = ${release.id} FOR UPDATE`;
		if (locked?.state !== 'PREVIEW') return; // published by an earlier attempt

		const actorId = await actorIdOf(tx, job.actor);
		const now = new Date();
		await tx.release.update({
			where: { id: release.id },
			data: {
				state: 'PUBLISHED',
				publishedAt: now,
				publishedById: actorId,
				artifactKey,
				manifestKey
			}
		});
		const shipped = await tx.$queryRaw<{ id: string }[]>`
			UPDATE quotes SET status = 'DATASET_RELEASE', updated_at = ${now}
			WHERE status = 'CURATED'
				AND id IN (SELECT quote_id FROM release_quotes WHERE release_id = ${release.id})
			RETURNING id`;
		await tx.quoteEvent.createMany({
			data: shipped.map((q) => ({
				quoteId: q.id,
				fromStatus: 'CURATED' as const,
				toStatus: 'DATASET_RELEASE' as const,
				actorId,
				note: `Shipped in ${release.version}`,
				at: now
			}))
		});
		await tx.auditLog.create({
			data: {
				actorId,
				actorHandle: job.actor?.handle ?? null,
				action: 'release.published',
				targetType: 'release',
				targetId: release.version,
				note: changeNote({
					eligible: release.eligibleCount,
					added: release.addedCount,
					corrected: release.correctedCount,
					withdrawn: release.withdrawnCount
				})
			}
		});
		published = true;
	}, READ_COMMITTED);

	const final = await db.release.findUniqueOrThrow({
		where: { id: release.id }
	});
	const manifest: Manifest = {
		version: final.version,
		schemaVersion: final.schemaVersion,
		publishedAt: final.publishedAt!.toISOString(),
		url: datasetUrl(options.baseUrl, final.version),
		size: final.sizeBytes!,
		sha256: final.sha256!,
		changes: {
			eligible: final.eligibleCount,
			added: final.addedCount,
			corrected: final.correctedCount,
			withdrawn: final.withdrawnCount
		}
	};
	await storage.put(manifestKey, JSON.stringify(manifest, null, 2), {
		contentType: 'application/json',
		cacheControl: IMMUTABLE,
		public: true
	});
	return { version: final.version, published, manifest };
}
