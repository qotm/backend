import { z } from 'zod';
import { dateTime } from 'common/schemas';

/** A CSV export's progress; `ready` once it can be downloaded. */
export const ExportStatusEntity = z
	.object({
		id: z.string().meta({ example: 'export-3f9c…' }),
		state: z.enum(['waiting', 'running', 'ready', 'failed']),
		/** Once ready: rows exported and the file's size. */
		rows: z.number().int().nullable(),
		bytes: z.number().int().nullable(),
		/** Why the last attempt failed; it may still be retried. */
		error: z.string().nullable(),
		requestedAt: dateTime()
	})
	.meta({ id: 'ExportStatusEntity' });
export type ExportStatusEntity = z.input<typeof ExportStatusEntity>;
