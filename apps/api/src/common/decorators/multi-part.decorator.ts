import { applyDecorators } from '@nestjs/common';
import { ApiConsumes } from '@nestjs/swagger';

export function MultipartFormData() {
	return applyDecorators(ApiConsumes('multipart/form-data'));
}
