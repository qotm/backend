import { Global, Module, RequestMethod } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { stdTimeFunctions, levels } from 'pino';
import { IncomingMessage, ServerResponse } from 'http';
import { CustomConfigService, GeneratorService } from 'common/services';
import { LoggerService } from '../services';
import {
	PINO_CONSOLE_TARGET,
	PINO_FILE_TARGET,
	PINO_CONSOLE_TARGET_PROD,
	PRETTY_AVAILABLE
} from '../constants';

@Global()
@Module({
	imports: [
		PinoLoggerModule.forRootAsync({
			inject: [CustomConfigService, GeneratorService],
			useFactory: async (
				config: CustomConfigService,
				gen: GeneratorService
			) => ({
				exclude: [{ method: RequestMethod.ALL, path: 'health' }],
				pinoHttp: {
					level: config.logger.level,
					transport:
						config.app.env === 'production' || !PRETTY_AVAILABLE
							? { targets: [PINO_CONSOLE_TARGET_PROD, PINO_FILE_TARGET] }
							: { targets: [PINO_CONSOLE_TARGET, PINO_FILE_TARGET] },
					autoLogging: {
						ignore: (req) => {
							const path = (
								(req as IncomingMessage & { originalUrl?: string })
									.originalUrl ??
								req.url ??
								''
							).split('?')[0];
							const muted = [
								'/dashboard',
								'/openapi',
								'/openapi-json',
								'/docs'
							]; // Bull Board + API docs, all mounted outside Nest
							return muted.some((p) => path === p || path.startsWith(p + '/'));
						}
					},
					base: {
						service: 'api',
						env: config.app.env
					},
					genReqId: (req: IncomingMessage, res: ServerResponse) => {
						const existing =
							(req.headers['x-request-id'] as string | undefined) ??
							(req as IncomingMessage & { id?: string }).id;
						const id = existing ?? gen.cuid();
						res.setHeader('X-Request-Id', id);
						return id;
					},
					redact: {
						paths: [
							'req.headers.authorization',
							'req.headers.cookie',
							'req.headers["x-api-key"]',
							'res.headers["set-cookie"]',
							'*.password',
							'*.token',
							'*.secret'
						],
						censor: '[REDACTED]'
					},
					serializers: {
						req(req) {
							return { id: req.id, method: req.method, url: req.url };
						},
						res(res) {
							return { statusCode: res.statusCode };
						}
					},
					customLogLevel: (_req, res, err) => {
						if (err || res.statusCode >= 500) return 'error';
						if (res.statusCode >= 400) return 'warn';
						return 'info';
					},
					customSuccessMessage: (req, res) =>
						`${req.method} ${req.url} ${res.statusCode}`,
					customErrorMessage: (req, res, err) =>
						`${req.method} ${req.url} ${res.statusCode} ${
							err?.message ?? ''
						}`.trim(),
					timestamp: stdTimeFunctions.isoTime,
					mixin(_mergeObject, level) {
						return { levelLabel: levels.labels[level] };
					}
				}
			})
		})
	],
	providers: [LoggerService],
	exports: [LoggerService]
})
export class LoggerModule {}
