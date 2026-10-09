import { z } from 'zod';

export const OKEntity = z
	.object({
		status: z.number().meta({ example: 200 }),
		message: z.string().meta({ example: 'ok' })
	})
	.meta({ id: 'OKEntity' });
export type OKEntity = z.input<typeof OKEntity>;

export const ok = (): OKEntity => ({ status: 200, message: 'ok' });
