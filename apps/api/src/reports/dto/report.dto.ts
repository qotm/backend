import { z } from 'zod';

/** The report dialog's choices ("Something else" is `other`). */
export const REPORT_REASONS = [
	'attribution',
	'content',
	'originality',
	'duplicate',
	'other'
] as const;

export const CreateReport = z
	.object({
		reason: z.enum(REPORT_REASONS),
		details: z
			.string()
			.trim()
			.max(2000)
			.optional()
			.transform((v) => v || undefined)
			.meta({ example: 'A link to the real source helps.' })
	})
	.meta({ id: 'CreateReport' });
export type CreateReport = z.output<typeof CreateReport>;
