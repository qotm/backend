import { z } from 'zod';
import type { SchemaObject } from '@nestjs/swagger';
import { binary } from 'common/schemas';

/**
 * The avatar upload body. Documentation only: the file itself arrives through
 * FileInterceptor, which the validation pipe does not see.
 */
export const AvatarUpload = z.object({ file: binary() });

export const AVATAR_UPLOAD_SCHEMA = z.toJSONSchema(AvatarUpload, {
	target: 'openapi-3.0'
}) as SchemaObject;
