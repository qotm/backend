import { applyDecorators, SerializeOptions } from '@nestjs/common';
import {
	ApiOkResponse,
	ApiParam,
	ApiOperation,
	ApiOperationOptions,
	ApiResponseOptions
} from '@nestjs/swagger';
import type { z } from 'zod';

/**
 * Declare what a handler returns: the schema is published as the OpenAPI
 * response and, through the global StandardSchemaSerializerInterceptor, is
 * what the response is serialized with — fields it does not declare are
 * dropped, and a return value that does not match fails loudly.
 */
export function Returns(
	schema: z.ZodType,
	options: Omit<ApiResponseOptions, 'type' | 'schema' | 'standardSchema'> = {}
) {
	return applyDecorators(
		ApiOkResponse({ ...options, standardSchema: schema }),
		SerializeOptions({ schema })
	);
}

export function IdParam(name = 'id') {
	return applyDecorators(ApiParam({ name, type: String }));
}

type OperationOptions = Omit<
	ApiOperationOptions,
	'summary' | 'description' | 'operationId'
>;
export function Op(
	operationId: string,
	summary: string,
	description: string | undefined = undefined,
	options: OperationOptions = {}
) {
	return applyDecorators(
		ApiOperation({
			summary,
			operationId,
			description,
			...options
		})
	);
}
