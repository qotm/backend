import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import {
	S3Client,
	PutObjectCommand,
	DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { BadRequestException } from '@nestjs/common';
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
});
