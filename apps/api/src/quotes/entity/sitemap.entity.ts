import { z } from 'zod';
import { dateTime } from 'common/schemas';

const Changed = { updatedAt: dateTime() };

export const SitemapEntity = z
	.object({
		/** Newest first, at most 50,000. */
		quotes: z.array(
			z.object({ id: z.string().meta({ example: 'q_8f2k1c' }), ...Changed })
		),
		authors: z.array(
			z.object({ slug: z.string().meta({ example: 'dijkstra' }), ...Changed })
		),
		topics: z.array(
			z.object({ slug: z.string().meta({ example: 'debugging' }), ...Changed })
		)
	})
	.meta({ id: 'SitemapEntity' });
export type SitemapEntity = z.input<typeof SitemapEntity>;
