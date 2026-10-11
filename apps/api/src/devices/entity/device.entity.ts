import { z } from 'zod';
import { dateTime } from 'common/schemas';

/** A terminal signed in with `qotm login` (Settings › Terminals). */
export const DeviceEntity = z
	.object({
		id: z.string(),
		label: z.string().meta({ example: 'MacBook · zsh' }),
		authorizedAt: dateTime(),
		lastSyncAt: dateTime().nullable(),
		datasetVersion: z.string().nullable().meta({ example: 'v2026.08.3' }),
		revokedAt: dateTime().nullable()
	})
	.meta({ id: 'DeviceEntity' });
export type DeviceEntity = z.input<typeof DeviceEntity>;
