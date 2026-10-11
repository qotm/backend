import { z } from 'zod';

/** What `qotm login` registers its terminal as (CLI contract, BUILD-PLAN §5). */
export const RegisterDevice = z
	.object({
		label: z.string().trim().min(1).max(80).meta({ example: 'MacBook · zsh' })
	})
	.meta({ id: 'RegisterDevice' });
export type RegisterDevice = z.output<typeof RegisterDevice>;

/**
 * The dataset version a terminal holds, sent by the CLI as `X-Qotm-Dataset`
 * (`v2026.09.1`). Anything else is ignored.
 */
export const DATASET_HEADER = 'x-qotm-dataset';
export const DATASET_VERSION = /^v\d{4}\.\d{2}\.\d+$/;
