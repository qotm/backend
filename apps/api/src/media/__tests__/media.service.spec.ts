import { TestBed, type Mocked } from '@suites/unit';
import type { Mock } from 'vitest';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { Enum } from 'common/utils';
import { MediaService } from 'media/services';
import { S3Service } from 'media/services';

describe('MediaService', () => {
	let service: MediaService;
	// Only `add` is exercised; Mocked<Queue> is too deep a type for tsc.
	let queue: { add: Mock<Queue['add']> };
	let s3: Mocked<S3Service>;

	beforeAll(async () => {
		const { unit, unitRef } = await TestBed.solitary(MediaService).compile();
		service = unit;
		queue = unitRef.get(getQueueToken('media'));
		s3 = unitRef.get(S3Service);
	});

	beforeEach(() => {
		queue.add.mockReset();
		s3.uploadFile.mockReset();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('uploadAvatar', () => {
		it('should delegate to S3Service.uploadFile with AVATARS folder', async () => {
			const file = {
				originalname: 'avatar.png',
				buffer: Buffer.from('avatar'),
				mimetype: 'image/png'
			} as any;
			const url = 'http://example.com/avatars/avatar.png';
			s3.uploadFile.mockResolvedValue(url);

			const result = await service.uploadAvatar(file);

			expect(s3.uploadFile).toHaveBeenCalledWith(
				file,
				Enum.UploadFolder.AVATARS
			);
			expect(result).toBe(url);
		});
	});

	describe('deleteFile', () => {
		it('should enqueue delete-file job on media queue', async () => {
			const url = 'http://example.com/avatars/avatar.png';

			await service.deleteFile(url);

			expect(queue.add).toHaveBeenCalledWith('delete-file', url);
		});
	});
});
