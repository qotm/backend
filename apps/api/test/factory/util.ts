import { ExecutionContext } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-vitest';

namespace Util {
	export type Context = DeepMocked<ExecutionContext>;

	export class ExceptionNotThrownError extends Error {
		constructor() {
			super('Exception not thrown');
			this.name = 'ExceptionNotThrownError';
		}
	}

	export class Mock {
		static executionContext() {
			return createMock<ExecutionContext>();
		}
	}
}

export { Util };
