import { resolveTelemetry } from '../config';

describe('resolveTelemetry', () => {
	const openobserve = {
		OPENOBSERVE_URL: 'https://o2.example.com/',
		OPENOBSERVE_ORG: 'qotm-api',
		OPENOBSERVE_TOKEN: 'o2oi_secret'
	};

	it('stays off without connection settings', () => {
		expect(resolveTelemetry({}).enabled).toBe(false);
	});

	it.each(['OPENOBSERVE_URL', 'OPENOBSERVE_ORG', 'OPENOBSERVE_TOKEN'])(
		'stays off when %s is missing',
		(key) => {
			const env: Record<string, string | undefined> = { ...openobserve };
			delete env[key];
			expect(resolveTelemetry(env).enabled).toBe(false);
		}
	);

	it('builds the OpenObserve endpoints and org-token auth', () => {
		const config = resolveTelemetry(openobserve, 'qotm-api');

		expect(config.enabled).toBe(true);
		expect(config.urls).toEqual({
			traces: 'https://o2.example.com/api/qotm-api/v1/traces',
			logs: 'https://o2.example.com/api/qotm-api/v1/logs',
			metrics: 'https://o2.example.com/api/qotm-api/v1/metrics'
		});
		expect(config.headers).toEqual({
			Authorization: `Basic ${Buffer.from('qotm-api:o2oi_secret').toString('base64')}`,
			'stream-name': 'qotm-api'
		});
	});

	it('uses OTEL_SERVICE_NAME, APP_ENV and OPENOBSERVE_STREAM', () => {
		const config = resolveTelemetry({
			...openobserve,
			OTEL_SERVICE_NAME: 'billing-api',
			APP_ENV: 'production',
			OPENOBSERVE_STREAM: 'api'
		});

		expect(config.serviceName).toBe('billing-api');
		expect(config.environment).toBe('production');
		expect(config.headers?.['stream-name']).toBe('api');
	});

	it('defers to the standard OTEL_* variables when they are set', () => {
		const config = resolveTelemetry({
			...openobserve,
			OTEL_EXPORTER_OTLP_ENDPOINT: 'https://collector.example.com'
		});

		expect(config.enabled).toBe(true);
		expect(config.urls).toBeUndefined();
		expect(config.headers).toBeUndefined();
	});

	it('honours OTEL_SDK_DISABLED over everything', () => {
		expect(
			resolveTelemetry({ ...openobserve, OTEL_SDK_DISABLED: 'true' }).enabled
		).toBe(false);
	});
});
