import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@qotm/db/client';
import { QuoteStatus, ReleaseState } from '@qotm/db/enums';
import { recordAudit, type AuditEntry } from 'audit';

/**
 * The only writes a release accepts. A published release is immutable: every
 * write here is a conditional update (or runs behind a row lock) that matches
 * only a draft or preview, so the state check and the write cannot be split
 * by a concurrent publish.
 */

type Db = Pick<PrismaClient, 'release' | '$transaction'>;

/** What a draft or preview may still change. */
export type ReleaseChanges = Partial<
	Pick<
		Prisma.ReleaseUncheckedUpdateInput,
		| 'eligibleCount'
		| 'addedCount'
		| 'correctedCount'
		| 'withdrawnCount'
		| 'schemaVersion'
	>
>;

/** The artifacts a preview build produced. */
export interface PreviewArtifacts {
	sizeBytes: number;
	sha256: string;
	artifactKey: string;
	manifestKey: string;
}

const UNPUBLISHED = { not: ReleaseState.PUBLISHED };

/**
 * Quotes a release may ship: curated ones, and those already shipped that
 * nothing has since withdrawn or disputed. The preview build (QOT-46/50)
 * compiles the dataset from exactly this set.
 */
export const RELEASE_ELIGIBLE = {
	status: { in: [QuoteStatus.CURATED, QuoteStatus.DATASET_RELEASE] }
} satisfies Prisma.QuoteWhereInput;

// Reads committed data and waits on row locks, rather than aborting
// concurrent writers as PrismaService's serializable default would.
const ISOLATION = {
	isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
};

/** Why a conditional write matched nothing: 404, or 409 naming the state. */
async function refuse(
	db: Pick<PrismaClient, 'release'>,
	id: string,
	action: string
): Promise<never> {
	const release = await db.release.findUnique({
		where: { id },
		select: { version: true, state: true }
	});
	if (!release) throw new NotFoundException('Release not found');
	if (release.state === ReleaseState.PUBLISHED) {
		throw new ConflictException(
			`Release ${release.version} is published and cannot be changed`
		);
	}
	throw new ConflictException(
		`Release ${release.version} cannot be ${action} while it is ${release.state.toLowerCase()}`
	);
}

/** Changes a draft or preview's counts or schema version. */
export async function updateRelease(
	db: Db,
	id: string,
	changes: ReleaseChanges
) {
	const { count } = await db.release.updateMany({
		where: { id, state: UNPUBLISHED },
		data: changes
	});
	if (count === 0) await refuse(db, id, 'changed');
}

/** Records a (re)built preview: its artifacts, and the PREVIEW state. */
export async function recordPreview(
	db: Db,
	id: string,
	artifacts: PreviewArtifacts
) {
	const { count } = await db.release.updateMany({
		where: { id, state: UNPUBLISHED },
		data: {
			...artifacts,
			state: ReleaseState.PREVIEW,
			previewBuiltAt: new Date()
		}
	});
	if (count === 0) await refuse(db, id, 'previewed');
}

/**
 * Replaces a draft or preview's quotes with `quotes`, each with its text as
 * it will ship. The release row is locked first, so a publish cannot land
 * between the state check and the write.
 */
export function setReleaseQuotes(
	db: Db,
	id: string,
	quotes: { quoteId: string; textAtRelease: string }[]
) {
	return db.$transaction(async (tx) => {
		const [release] = await tx.$queryRaw<{ state: ReleaseState }[]>`
			SELECT state FROM releases WHERE id = ${id} FOR UPDATE`;
		if (!release || release.state === ReleaseState.PUBLISHED) {
			await refuse(tx, id, 'changed');
		}
		await tx.releaseQuote.deleteMany({ where: { releaseId: id } });
		await tx.releaseQuote.createMany({
			data: quotes.map((quote) => ({ releaseId: id, ...quote }))
		});
	}, ISOLATION);
}

/**
 * Publishes a built preview, once: of two racing publishes exactly one
 * matches. Audited in the same transaction.
 */
export function publishRelease(
	db: Db,
	id: string,
	actor: NonNullable<AuditEntry['actor']>
) {
	return db.$transaction(async (tx) => {
		const { count } = await tx.release.updateMany({
			where: { id, state: ReleaseState.PREVIEW, sha256: { not: null } },
			data: {
				state: ReleaseState.PUBLISHED,
				publishedAt: new Date(),
				publishedById: actor.id
			}
		});
		if (count === 0) await refuse(tx, id, 'published');

		const release = await tx.release.findUniqueOrThrow({ where: { id } });
		await recordAudit(tx, {
			actor,
			action: 'release.published',
			target: { type: 'release', id: release.version },
			note: `+${release.addedCount} ~${release.correctedCount} −${release.withdrawnCount}`
		});
		return release;
	}, ISOLATION);
}
