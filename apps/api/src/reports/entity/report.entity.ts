import { z } from 'zod';
import { ReportStatus } from '@qotm/db/enums';
import { dateTime } from 'common/schemas';
import { REPORT_REASONS } from '../dto';

export const ReportEntity = z
	.object({
		id: z.string().meta({ example: 'r_0412' }),
		quote: z.string().meta({ example: 'q_5d3a8w' }),
		reason: z.enum(REPORT_REASONS),
		details: z.string().nullable(),
		status: z.enum(ReportStatus),
		createdAt: dateTime()
	})
	.meta({ id: 'ReportEntity' });
export type ReportEntity = z.input<typeof ReportEntity>;
