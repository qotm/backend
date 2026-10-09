/**
 * OpenTelemetry bootstrap: traces, logs and metrics over OTLP. main.ts imports
 * this first, because instrumentation has to patch modules before anything
 * requires them. Connection settings are in src/telemetry/config.ts; without
 * them this file does nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolveTelemetry } from './telemetry/config';

// Nest reads .env later, through ConfigModule; the connection settings are
// needed now. Already-set variables (Docker, the shell) are never overridden.
try {
	process.loadEnvFile();
} catch {
	// no .env — the environment is configured some other way
}

const telemetry = resolveTelemetry();

if (telemetry.enabled) {
	// Nest 12 and many of its dependencies load as ESM, which require-hooks do
	// not see; import-in-the-middle lets instrumentations patch those too.
	register('import-in-the-middle/hook.mjs', pathToFileURL(__filename));
	start();
}

function start() {
	/* eslint-disable @typescript-eslint/no-require-imports */
	// Required lazily so a project with telemetry off never loads the SDK, and
	// typed so the compiler still checks every constructor call below.
	const { NodeSDK } =
		require('@opentelemetry/sdk-node') as typeof import('@opentelemetry/sdk-node');
	const { getNodeAutoInstrumentations } =
		require('@opentelemetry/auto-instrumentations-node') as typeof import('@opentelemetry/auto-instrumentations-node');
	const { OTLPTraceExporter } =
		require('@opentelemetry/exporter-trace-otlp-proto') as typeof import('@opentelemetry/exporter-trace-otlp-proto');
	const { OTLPLogExporter } =
		require('@opentelemetry/exporter-logs-otlp-proto') as typeof import('@opentelemetry/exporter-logs-otlp-proto');
	const { OTLPMetricExporter } =
		require('@opentelemetry/exporter-metrics-otlp-proto') as typeof import('@opentelemetry/exporter-metrics-otlp-proto');
	const { BatchLogRecordProcessor } =
		require('@opentelemetry/sdk-logs') as typeof import('@opentelemetry/sdk-logs');
	const { PeriodicExportingMetricReader } =
		require('@opentelemetry/sdk-metrics') as typeof import('@opentelemetry/sdk-metrics');
	const { resourceFromAttributes } =
		require('@opentelemetry/resources') as typeof import('@opentelemetry/resources');
	const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } =
		require('@opentelemetry/semantic-conventions') as typeof import('@opentelemetry/semantic-conventions');
	const { ExpressLayerType } =
		require('@opentelemetry/instrumentation-express') as typeof import('@opentelemetry/instrumentation-express');
	const { PrismaInstrumentation } =
		require('@prisma/instrumentation') as typeof import('@prisma/instrumentation');
	/* eslint-enable @typescript-eslint/no-require-imports */

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
				'@opentelemetry/instrumentation-net': { enabled: false },
				// One span per request handler, not one per middleware layer. Express
				// 5 routes through the `router` package, whose own instrumentation
				// would add a span for every layer again.
				'@opentelemetry/instrumentation-express': {
					ignoreLayersType: [ExpressLayerType.MIDDLEWARE]
				},
				'@opentelemetry/instrumentation-router': { enabled: false }
			}),
			new PrismaInstrumentation()
		]
	});
	sdk.start();

	// Flush what is buffered on the way out, then let the signal do what it
	// would have done without a handler.
	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		process.once(signal, () => {
			sdk.shutdown().finally(() => process.kill(process.pid, signal));
		});
	}
}

function packageVersion(): string | undefined {
	try {
		const file = path.join(process.cwd(), 'package.json');
		return JSON.parse(fs.readFileSync(file, 'utf8')).version;
	} catch {
		return undefined;
	}
}
