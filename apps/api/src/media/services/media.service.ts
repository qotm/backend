import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Enum } from 'common/utils';
import { S3Service } from './s3.service';

@Injectable()
export class MediaService {
	constructor(
		@InjectQueue('media') private queue: Queue,
		private s3: S3Service
	) {}

	async uploadAvatar(file: Express.Multer.File) {
		return await this.s3.uploadFile(file, Enum.UploadFolder.AVATARS);
	}

	async uploadFile(file: Express.Multer.File, folder: Enum.UploadFolder) {
		return await this.s3.uploadFile(file, folder);
	}

	async getFileBuffer(url: string): Promise<Buffer> {
		return await this.s3.getFileBuffer(this.s3.getKeyFromUrl(url));
	}

	async deleteFile(data: string) {
		this.queue.add('delete-file', data);
	}
}
