import 'dotenv/config';
import { DocumentBuilder } from '@nestjs/swagger';
import { OriginBuilder } from '../misc';

// Read directly from `process.env`, not CustomConfigService: these constants are
// evaluated at module load, before Nest's DI container exists.
const { env: E } = process;

const port = E.PORT!;
const host = E.SERVER_HOST!;
const appHost = E.APP_HOST!;
const frontendHost = E.FRONTEND_HOST!;

const env = E.APP_ENV!;
const IS_DEV = env === 'development';

// The same origins better-auth trusts, in every environment: an origin trusted
// for sign-in but refused by CORS can't reach the API at all (every
// react-monorepo app beyond FRONTEND_HOST). MISC_CORS_ORIGINS is empty unless
// you list something.
const CORS_ORIGINS = [
	frontendHost,
	...OriginBuilder.build(E.MISC_CORS_ORIGINS)
];

const createDocumentBuilder = () => {
	const builder = new DocumentBuilder()
		.setTitle('Qotm Api API')
		.setDescription('API for the Qotm Api application')
		.setVersion('1.0')
		.addTag('App')
		.addTag('Users', 'User management and authentication')
		.addTag('Current User', 'Current authenticated user information')
		.addBearerAuth();

	builder.addServer(host);
	if (IS_DEV) {
		builder
			.addServer(`http://localhost:${port}`, 'Local Development')
			.addServer(`http://${appHost}:${port}`, 'Dynamic Development');
	}
	return builder.build();
};

export const SWAGGER_OPTIONS = createDocumentBuilder();

export const CORS_OPTIONS = {
	origin: CORS_ORIGINS,
	credentials: true,
	methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
	preflightContinue: false,
	optionsSuccessStatus: 204,
	// The site's browser monitoring adds a traceparent header to every API
	// call, which makes each one a preflighted request. Without a max age a
	// browser keeps the preflight for 5s, so nearly every call paid an extra
	// round trip. Two hours is Chrome's ceiling.
	maxAge: 7200
};
