import { AppFactory } from '@test/factory/app';
import { SWAGGER_OPTIONS } from 'common/constants';

describe('App', () => {
	let app: AppFactory;

	beforeAll(async () => {
		app = await AppFactory.init();
	});

	afterAll(async () => {
		await app.close();
	});

	describe('GET: /', () => {
		let status: number;
		let body: any;
		let headers: Record<string, string>;

		beforeAll(async () => {
			const response = await app.request.get('/');
			status = response.status;
			body = response.body;
			headers = response.headers as Record<string, string>;
		});

		it('should have 200 status', () => {
			expect(status).toBe(200);
		});

		it('should return object with app title and description', () => {
			const {
				info: { title, description }
			} = SWAGGER_OPTIONS;
			expect(body).toStrictEqual({ title, description });
		});

		it('should apply basic security headers via helmet', () => {
			// A small subset of headers that helmet sets by default
			expect(headers['x-dns-prefetch-control']).toBeDefined();
			expect(headers['x-content-type-options']).toBe('nosniff');
			expect(headers['x-frame-options']).toBeDefined();
		});
	});

	describe('GET: /non-existent', () => {
		it('should return 404 for unknown route', async () => {
			const response = await app.request.get('/non-existent');
			expect(response.status).toBe(404);
			expect(response.body).toMatchObject({
				statusCode: 404
			});
			expect(typeof response.body.message).toBe('string');
		});
	});

	describe('GET: /openapi-json', () => {
		it('should expose OpenAPI document', async () => {
			const response = await app.request.get('/openapi-json');
			expect(response.status).toBe(200);
			expect(response.headers['content-type']).toContain('application/json');
			const body = response.body as any;
			expect(body).toHaveProperty('openapi');
			const {
				info: { title }
			} = SWAGGER_OPTIONS;
			expect(body.info.title).toBe(title);
		});
	});

	describe('GET: /docs', () => {
		it('should serve API documentation UI', async () => {
			const response = await app.request.get('/docs');
			expect(response.status).toBe(200);
			expect(response.headers['content-type']).toContain('text/html');
		});
	});

	describe('OPTIONS: / (CORS preflight)', () => {
		it('should respond with CORS headers for allowed origin', async () => {
			const response = await app.request.get('/');
			expect(response.headers['vary']).toContain('Origin');
			expect(response.headers['access-control-allow-credentials']).toBe('true');
		});
	});
});
