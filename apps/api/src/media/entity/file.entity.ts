import { z } from 'zod';
import { faker as F } from '@faker-js/faker';

export const FileEntity = z
	.object({ path: z.string().meta({ example: F.image.avatar() }) })
	.meta({ id: 'FileEntity' });
export type FileEntity = z.input<typeof FileEntity>;
