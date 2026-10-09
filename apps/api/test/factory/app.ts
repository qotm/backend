import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import supertest from 'supertest';
import { vi } from 'vitest';
import { AppModule } from 'app.module';
import { CustomConfigService, PrismaService } from 'common/services';
import { CacheService } from 'common/services';
import { MailService } from 'common/services';
import { MediaService } from 'media/services';
import Seeder from '@seeders/util';
import * as setup from 'app.setup';

type Cookie = string[] | undefined;

/**
 * Boots the *real* Nest application against the real test Postgres and Redis —
 * only the outbound integrations are replaced. Mirrors `app.setup.ts`, so a
 * global pipe or filter added there has to be added here too or e2e will pass
 * on behaviour production does not have.
 *
 * Always `await app.close()` in `afterAll`: it triggers `refresh()`, and a spec
 * that skips it leaves rows behind for the next one.
 */
export class AppFactory {
	private constructor(private readonly app: INestApplication) {}

	get instance() {
		return this.app;
	}

	get server() {
		return this.app.getHttpServer();
	}

	get request() {
		return supertest(this.server);
	}

	get db() {
		return this.app.get(PrismaService);
	}

	get cache() {
		return this.app.get(CacheService);
	}

	get config() {
		return this.app.get(CustomConfigService);
	}

	async refresh() {
		await this.db.truncate();
		await this.cache.truncate();
		await this.seed();
	}

	async seed() {
		await Seeder.setup(this.db).seed(this.config.superuser, true);
	}

	async signIn(email: string, password: string) {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const response = await this.request.post('/auth/sign-in/email').send({
			email,
			password
		});
		errorSpy.mockRestore();

		const setCookie = response.headers['set-cookie'] as unknown as Cookie;
		const cookie = setCookie?.[0];
		return { cookie, response };
	}

	async close() {
		await this.refresh();
		await this.app.close();
	}

	static async init() {
		// No-op MailService so nothing is enqueued to the BullMQ `mail` queue.
		// cache.truncate() (Redis flushall) runs between specs and would wipe
		// in-flight job keys, making the worker throw "Missing key for job N".
		// (Listed explicitly — a Proxy that answers every prop, incl. `then`,
		// makes this look thenable and Nest DI hangs awaiting it.)
		const mailMock: Record<keyof MailService, ReturnType<typeof vi.fn>> = {
			activation: vi.fn(),
			activationTwofa: vi.fn(),
			welcome: vi.fn(),
			forgotPassword: vi.fn(),
			resetPassword: vi.fn(),
			passwordChanged: vi.fn(),
			setPassword: vi.fn()
		};

		// In-memory MediaService so uploads never touch real S3. Buffers are kept
		// keyed by their fake URL so an async worker can re-read what was uploaded.
		const mediaFiles = new Map<string, Buffer>();
		const mediaMock: Partial<Record<keyof MediaService, unknown>> = {
			uploadAvatar: vi.fn(async () => 'https://test.local/avatars/mock.png'),
			uploadFile: vi.fn(async (file: Express.Multer.File) => {
				const url = `https://test.local/uploads/${Math.random()
					.toString(36)
					.slice(2)}`;
				mediaFiles.set(url, file.buffer);
				return url;
			}),
			getFileBuffer: vi.fn(
				async (url: string) => mediaFiles.get(url) ?? Buffer.alloc(0)
			),
			deleteFile: vi.fn(async () => {})
		};

		const module: TestingModule = await Test.createTestingModule({
			imports: [AppModule]
		})
			.overrideProvider(MailService)
			.useValue(mailMock)
			.overrideProvider(MediaService)
			.useValue(mediaMock)
			.compile();

		const app = module.createNestApplication({
			bodyParser: false,
			bufferLogs: true
		});

		setup.usePinoLogger(app);
		setup.enableVersioning(app);
		setup.setStatic(app);
		setup.enableJsonBodyParser(app);
		setup.useGlobalPipes(app);
		setup.useGlobalInterceptors(app);
		setup.useGlobalFilters(app);
		await setup.enableOpenAPI(app);
		setup.enableCors(app);
		setup.enableHelmet(app);

		await app.init();
		return new AppFactory(app);
	}
}
