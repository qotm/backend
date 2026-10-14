import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import {
	S3Client,
	PutObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command
} from '@aws-sdk/client-s3';
import {
	BadRequestException,
	ServiceUnavailableException
} from '@nestjs/common';
import { Enum } from 'common/utils';
import {
	CustomConfigService,
	GeneratorService,
	LoggerService
} from 'common/services';
import { S3Service } from 'media/services';

describe('S3Service', () => {
	let service: S3Service;
	let sendSpy: ReturnType<typeof vi.spyOn>;

	const mockConfig: Partial<CustomConfigService> = {
		s3: {
			accessKeyId: 'ACCESS_KEY_ID',
			secretAccessKey: 'SECRET_ACCESS_KEY',
			endpoint: 'http://localhost:9000',
			bucket: 'test-bucket',
			region: 'us-east-1'
		}
	} as any;

	const mockGen: Partial<GeneratorService> = {
		cuid: () => 'test-uuid'
	} as any;

	/*
	 * S3Service gained a LoggerService dependency; without a stub Nest fails to
	 * construct it and vitest reports a failed *suite* with all 7 tests skipped —
	 * green-looking output hiding zero coverage. Only `error` is called (the
	 * upload catch), but the rest are stubbed so a new log line can't resurrect
	 * that failure mode.
	 */
	const mockLogger = {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn()
	} as unknown as LoggerService;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				S3Service,
				{
					provide: CustomConfigService,
					useValue: mockConfig
				},
				{
					provide: GeneratorService,
					useValue: mockGen
				},
				{
					provide: LoggerService,
					useValue: mockLogger
				}
			]
		}).compile();

		service = module.get(S3Service);
		sendSpy = vi
			.spyOn(S3Client.prototype as any, 'send')
			.mockResolvedValue({} as any);
	});

	beforeEach(() => {
		sendSpy.mockClear();
	});

	afterAll(() => {
		vi.restoreAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getKey', () => {
		it('should build key using folder, uuid and file extension', () => {
			const file = { originalname: 'photo.jpg' } as any;
			const key = service.getKey(Enum.UploadFolder.AVATARS, file);
			expect(key).toBe('avatars/test-uuid.jpg');
		});
	});

	describe('getUrl / getKeyFromUrl / isHostedUrl', () => {
		it('should build and parse hosted URLs correctly', () => {
			const key = 'avatars/test-uuid.jpg';
			const url = service.getUrl(key);
			expect(url).toBe(
				'http://localhost:9000/test-bucket/avatars/test-uuid.jpg'
			);
			expect(service.getKeyFromUrl(url)).toBe(key);
			expect(service.isHostedUrl(url)).toBe(true);
			expect(
				service.isHostedUrl('http://external.com/avatars/test-uuid.jpg')
			).toBe(false);
		});
	});

	describe('uploadFile', () => {
		it('should upload file and return its URL', async () => {
			const file = {
				originalname: 'photo.jpg',
				buffer: Buffer.from('data'),
				mimetype: 'image/jpeg'
			} as any;

			const result = await service.uploadFile(file, Enum.UploadFolder.AVATARS);

			expect(sendSpy).toHaveBeenCalledTimes(1);
			const command = sendSpy.mock.calls[0][0];
			expect(command).toBeInstanceOf(PutObjectCommand);
			const expectedUrl =
				'http://localhost:9000/test-bucket/avatars/test-uuid.jpg';
			expect(result).toBe(expectedUrl);
		});

		it('should throw BadRequestException when upload fails', async () => {
			sendSpy.mockRejectedValueOnce(new Error('upload failed'));

			const file = {
				originalname: 'photo.jpg',
				buffer: Buffer.from('data'),
				mimetype: 'image/jpeg'
			} as any;

			await expect(
				service.uploadFile(file, Enum.UploadFolder.AVATARS)
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('deleteFile', () => {
		it('should delete file without error', async () => {
			await service.deleteFile('avatars/test-uuid.jpg');

			expect(sendSpy).toHaveBeenCalledTimes(1);
			const command = sendSpy.mock.calls[0][0];
			expect(command).toBeInstanceOf(DeleteObjectCommand);
		});

		it('should throw BadRequestException when delete fails', async () => {
			sendSpy.mockRejectedValueOnce(new Error('delete failed'));

			await expect(service.deleteFile('avatars/test-uuid.jpg')).rejects.toThrow(
				BadRequestException
			);
		});
	});
	describe('exists', () => {
		const status = (code: number, name = 'Unknown') =>
			Object.assign(new Error(name), {
				name,
				$metadata: { httpStatusCode: code }
			});
		const key = 'share/q_8f2k1c/quote-abc.png';

		it('is true when the HEAD succeeds, false on a 404', async () => {
			expect(await service.exists(key)).toBe(true);
			sendSpy.mockRejectedValueOnce(status(404, 'NotFound'));
			expect(await service.exists(key)).toBe(false);
		});

		it('settles a 403 by listing the exact key (RustFS answers a missing key with 403)', async () => {
			sendSpy
				.mockRejectedValueOnce(status(403))
				.mockResolvedValueOnce({ Contents: [] });
			expect(await service.exists(key)).toBe(false);
			expect(sendSpy.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
			const list = sendSpy.mock.calls[1][0] as ListObjectsV2Command;
			expect(list).toBeInstanceOf(ListObjectsV2Command);
			expect(list.input).toMatchObject({ Prefix: key, MaxKeys: 1 });

			sendSpy
				.mockRejectedValueOnce(status(403))
				.mockResolvedValueOnce({ Contents: [{ Key: key }] });
			expect(await service.exists(key)).toBe(true);

			sendSpy
				.mockRejectedValueOnce(status(403))
				.mockResolvedValueOnce({ Contents: [{ Key: `${key}.old` }] });
			expect(await service.exists(key)).toBe(false);
		});

		it('is a 503 when the listing is refused too: our credentials, not the caller', async () => {
			sendSpy
				.mockRejectedValueOnce(status(403))
				.mockRejectedValueOnce(status(403, 'AccessDenied'));
			await expect(service.exists(key)).rejects.toThrow(
				ServiceUnavailableException
			);
		});

		it('is a 503 when storage is down', async () => {
			sendSpy.mockRejectedValueOnce(status(503, 'ServiceUnavailable'));
			await expect(service.exists(key)).rejects.toThrow(
				ServiceUnavailableException
			);
		});
	});
});
