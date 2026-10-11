import { z } from 'zod';
import { dateTime } from 'common/schemas';

const changes = z.object({
	eligible: z.number().int().meta({ example: 12701 }),
	added: z.number().int().meta({ example: 74 }),
	corrected: z.number().int().meta({ example: 9 }),
	withdrawn: z.number().int().meta({ example: 4 })
});

/** What `qotm sync` reads (BUILD-PLAN §5, "Sync"). */
export const ManifestEntity = z
	.object({
		version: z.string().meta({ example: 'v2026.09.1' }),
		schemaVersion: z.number().int().meta({ example: 1 }),
		publishedAt: dateTime(),
		/** Immutable: the CLI refuses a download whose size or sha256 differs. */
		url: z.string().meta({
			example: 'https://releases.qotm.dev/v2026.09.1/qotm.sqlite'
		}),
		size: z.number().int().meta({ example: 2_900_000 }),
		sha256: z.string().meta({ example: '4b7e91…c02a' }),
		changes
	})
	.meta({ id: 'ManifestEntity' });
export type ManifestEntity = z.input<typeof ManifestEntity>;

/** The Curated page's line: "the current release, v2026.08.3 · 12,631 quotes". */
export const CurrentReleaseEntity = z
	.object({
		version: z.string().meta({ example: 'v2026.08.3' }),
		publishedAt: dateTime(),
		schemaVersion: z.number().int(),
		quotes: z.number().int().meta({ example: 12631 }),
		changes
	})
	.meta({ id: 'CurrentReleaseEntity' });
export type CurrentReleaseEntity = z.input<typeof CurrentReleaseEntity>;
