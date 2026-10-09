/**
 * Where telemetry goes, resolved from the environment before anything else
 * loads (instrumentation runs ahead of Nest, so it cannot use
 * CustomConfigService — this is the one place that reads process.env for it).
 *
 * Two ways to connect, in order of precedence:
 * - standard OpenTelemetry variables (OTEL_EXPORTER_OTLP_ENDPOINT and friends),
 *   which the SDK reads itself, for any OTLP backend;
 * - OPENOBSERVE_URL + OPENOBSERVE_ORG + OPENOBSERVE_TOKEN, from which the
 *   OpenObserve endpoint and auth header are built.
 * With neither, telemetry stays off and the SDK is never started.
 */
export interface TelemetryConfig {
	enabled: boolean;
	serviceName: string;
	environment: string;
	/** Signal URLs; undefined means the SDK resolves them from OTEL_* vars. */
	urls?: { traces: string; logs: string; metrics: string };
	headers?: Record<string, string>;
}

type Env = Record<string, string | undefined>;

export function resolveTelemetry(
	env: Env = process.env,
	defaultServiceName = 'qotm-api'
): TelemetryConfig {
	const serviceName = env.OTEL_SERVICE_NAME || defaultServiceName;
	const environment = env.APP_ENV || 'development';
	const off = { enabled: false, serviceName, environment };

	if (env.OTEL_SDK_DISABLED === 'true') return off;
	if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
		return { enabled: true, serviceName, environment };
	}

	const {
		OPENOBSERVE_URL: url,
		OPENOBSERVE_ORG: org,
		OPENOBSERVE_TOKEN: token
	} = env;
	if (!url || !org || !token) return off;

	// OTLP/HTTP endpoints live under /api/<org>; an org ingestion token
	// authenticates as `<org>:<token>`. Logs and traces land in the stream
	// named here — one per service keeps an API and its workers apart.
	const base = `${url.replace(/\/+$/, '')}/api/${org}`;
	return {
		enabled: true,
		serviceName,
		environment,
		urls: {
			traces: `${base}/v1/traces`,
			logs: `${base}/v1/logs`,
			metrics: `${base}/v1/metrics`
		},
		headers: {
			Authorization: `Basic ${Buffer.from(`${org}:${token}`).toString('base64')}`,
			'stream-name': env.OPENOBSERVE_STREAM || serviceName
		}
	};
}
