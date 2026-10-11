import { z } from 'zod';
import { ReleaseState } from '@qotm/db/enums';
import { dateTime } from 'common/schemas';

/** ReleaseSummary and a row of the Published table. */
export const AdminReleaseEntity = z
	.object({
		version: z.string().meta({ example: 'v2026.09.1' }),
		state: z.enum(ReleaseState),
		schemaVersion: z.number().int().meta({ example: 1 }),
		eligible: z.number().int().meta({ example: 12701 }),
		added: z.number().int().meta({ example: 74 }),
		corrected: z.number().int().meta({ example: 9 }),
		withdrawn: z.number().int().meta({ example: 4 }),
		/** "+74 ~9 −4". */
		changes: z.string().meta({ example: '+74 ~9 −4' }),
		/** Of qotm.sqlite, once a preview is built. */
		sizeBytes: z.number().int().nullable().meta({ example: 2_900_000 }),
		sha256: z.string().nullable(),
		previewBuiltAt: dateTime().nullable(),
		publishedAt: dateTime().nullable(),
		publishedBy: z.object({ handle: z.string() }).nullable()
	})
	.meta({ id: 'AdminReleaseEntity' });
export type AdminReleaseEntity = z.input<typeof AdminReleaseEntity>;

export const AdminReleasesEntity = z
	.object({
		/** The release not yet published (draft or preview), if any. */
		current: AdminReleaseEntity.nullable(),
		/** Whether a preview build is waiting or running. */
		building: z.boolean(),
		/** Published releases, newest first, paged. */
		total: z.number().int(),
		pageSize: z.number().int(),
		currentPage: z.number().int(),
		lastPage: z.number().int(),
		list: z.array(AdminReleaseEntity)
	})
	.meta({ id: 'AdminReleasesEntity' });
export type AdminReleasesEntity = z.input<typeof AdminReleasesEntity>;

/** A queued build or publish; the worker does the rest. */
export const ReleaseJobEntity = z
	.object({
		release: AdminReleaseEntity,
		queued: z.literal(true)
	})
	.meta({ id: 'ReleaseJobEntity' });
export type ReleaseJobEntity = z.input<typeof ReleaseJobEntity>;
