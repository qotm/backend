/**
 * Preloaded with `node --import` ahead of the worker (see the start scripts,
 * ecosystem.config.cjs and the Dockerfile), for anything that has to run before
 * the worker's own modules load.
 */
// OpenTelemetry: traces, logs and metrics over OTLP. It has to be preloaded
// because ESM links the whole import graph before running any of it, so
// patching modules from inside src/index.ts would be too late. Connection
// settings are in src/telemetry/config.ts; without them this does nothing.
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { resolveTelemetry } from '#app/telemetry/config.js';

// config.ts loads .env later; the connection settings are needed now.
// Already-set variables are never overridden.
try {
	process.loadEnvFile();
} catch {
	// no .env — the environment is configured some other way
}

const telemetry = resolveTelemetry();

if (telemetry.enabled) {
	register('import-in-the-middle/hook.mjs', import.meta.url);

	// Imported only when enabled, so a worker without telemetry never loads the SDK.
	const [
		{ NodeSDK },
		{ getNodeAutoInstrumentations },
		{ OTLPTraceExporter },
		{ OTLPLogExporter },
		{ OTLPMetricExporter },
		{ BatchLogRecordProcessor },
		{ PeriodicExportingMetricReader },
		{ resourceFromAttributes },
		{ ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION },
		{ PrismaInstrumentation }
	] = await Promise.all([
		import('@opentelemetry/sdk-node'),
		import('@opentelemetry/auto-instrumentations-node'),
		import('@opentelemetry/exporter-trace-otlp-proto'),
		import('@opentelemetry/exporter-logs-otlp-proto'),
		import('@opentelemetry/exporter-metrics-otlp-proto'),
		import('@opentelemetry/sdk-logs'),
		import('@opentelemetry/sdk-metrics'),
		import('@opentelemetry/resources'),
		import('@opentelemetry/semantic-conventions'),
		import('@prisma/instrumentation')
	]);

	const { urls, headers } = telemetry;
	// Explicit URLs always come with their headers; without them the SDK reads
	// OTEL_EXPORTER_OTLP_* itself.
	const exporter = (url?: string) => (url && headers ? { url, headers } : {});

	const sdk = new NodeSDK({
		resource: resourceFromAttributes({
			[ATTR_SERVICE_NAME]: telemetry.serviceName,
			[ATTR_SERVICE_VERSION]: packageVersion(),
			'deployment.environment.name': telemetry.environment
		}),
		traceExporter: new OTLPTraceExporter(exporter(urls?.traces)),
		logRecordProcessors: [
			new BatchLogRecordProcessor({
				exporter: new OTLPLogExporter(exporter(urls?.logs))
			})
		],
		metricReaders: [
			new PeriodicExportingMetricReader({
				exporter: new OTLPMetricExporter(exporter(urls?.metrics)),
				exportIntervalMillis:
					Number(process.env.OTEL_METRIC_EXPORT_INTERVAL) || 60_000
			})
		],
		instrumentations: [
			getNodeAutoInstrumentations({
				// Every file read and DNS lookup as a span is noise, not signal.
				'@opentelemetry/instrumentation-fs': { enabled: false },
				'@opentelemetry/instrumentation-dns': { enabled: false },
				'@opentelemetry/instrumentation-net': { enabled: false }
			}),
			new PrismaInstrumentation()
		]
	});
	sdk.start();

	// Flush what is buffered on the way out, then let the signal do what it
	// would have done without a handler.
	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		process.once(signal, () => {
			void sdk.shutdown().finally(() => process.kill(process.pid, signal));
		});
	}
}

function packageVersion(): string | undefined {
	try {
		const file = path.join(process.cwd(), 'package.json');
		return (JSON.parse(fs.readFileSync(file, 'utf8')) as { version?: string })
			.version;
	} catch {
		return undefined;
	}
}

export {};
