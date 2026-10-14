import {
	BadRequestException,
	Injectable,
	ServiceUnavailableException
} from '@nestjs/common';
import {
	S3Client,
	PutObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command
} from '@aws-sdk/client-s3';
import path from 'path';
import {
	CustomConfigService,
	GeneratorService,
	LoggerService
} from 'common/services';
import { Enum } from 'common/utils';

@Injectable()
export class S3Service {
	private client: S3Client;

	constructor(
		private config: CustomConfigService,
		private gen: GeneratorService,
		private logger: LoggerService
	) {
		const { accessKeyId, region, endpoint, secretAccessKey } = this.config.s3;
		this.client = new S3Client({
			region,
			endpoint,
			credentials: {
				accessKeyId,
				secretAccessKey
			},
			forcePathStyle: true,
			// Without these the SDK defaults leave a request outstanding for minutes
			// when the storage host accepts the TCP connection but never answers —
			// every caller (statement import, avatars, feedback attachments) inherits
			// that hang. Bound it so an unreachable bucket surfaces as a fast error.
			requestHandler: {
				connectionTimeout: 5_000,
				// Socket-inactivity timeout, so a steadily streaming large upload will
				// not trip it. Sized with `maxAttempts` so the worst case (~30s) lands
				// inside the client's own upload timeout — the browser must receive our
				// error rather than give up first and show a generic "connection lost".
				requestTimeout: 15_000,
				// Without this the handler only logs a warning when requestTimeout
				// elapses and lets the socket keep hanging — the timeout has to be
				// opted into as an actual error.
				throwOnRequestTimeout: true
			},
			maxAttempts: 2
		});
	}

	private get pathPrefix() {
		const { endpoint, bucket } = this.config.s3;
		return `${endpoint}/${bucket}/`;
	}

	getKey(
		folder: Enum.UploadFolder,
		file: Express.Multer.File,
		name?: string
	): string {
		return `${folder}/${name ?? this.gen.cuid()}${path.extname(
			file.originalname
		)}`;
	}

	getKeyFromUrl(url: string) {
		return url.replace(this.pathPrefix, '');
	}

	getUrl(key: string) {
		return this.pathPrefix + key;
	}

	isHostedUrl(url: string) {
		return url.startsWith(this.pathPrefix);
	}

	/**
	 * Storage failures are not the caller's fault. A timeout / DNS / refused-connection
	 * error means the bucket host is unreachable — that is a 503 the client can retry,
	 * not a 400 telling the user their file was bad. Storage refusing our own
	 * credentials (401/403) is ours to fix, so it is a 503 too, logged as such.
	 * Anything else (a bad key or ACL in the request) stays a 400.
	 */
	private toException(error: any, action: 'store' | 'read') {
		const transportCodes = [
			'TimeoutError',
			'ECONNREFUSED',
			'ECONNRESET',
			'ENOTFOUND',
			'EAI_AGAIN',
			'EPIPE',
			'ETIMEDOUT'
		];
		const code = error?.name ?? error?.code;
		const unreachable =
			transportCodes.includes(code) ||
			transportCodes.includes(error?.$metadata?.httpStatusCode) ||
			error?.$metadata?.httpStatusCode >= 500;
		const refused = [401, 403].includes(error?.$metadata?.httpStatusCode);

		if (unreachable || refused) {
			this.logger.error(
				{ err: error, action, endpoint: this.config.s3.endpoint },
				refused
					? 'File storage refused our credentials: check the access key and its policy.'
					: 'File storage is unreachable.'
			);
			return new ServiceUnavailableException(
				`We could not ${action} the file right now — storage is unavailable. Please try again shortly.`
			);
		}
		return new BadRequestException(error.message);
	}

	async uploadFile(file: Express.Multer.File, folder: Enum.UploadFolder) {
		try {
			const key = this.getKey(folder, file);
			const acl = Enum.isPrivateUploadFolder(folder)
				? 'private'
				: 'public-read';
			const command = new PutObjectCommand({
				Bucket: this.config.s3.bucket,
				Key: key,
				Body: file.buffer,
				ContentType: file.mimetype,
				ACL: acl,
				Metadata: {
					originalName: file.originalname
				}
			});
			await this.client.send(command);
			return this.getUrl(key);
		} catch (error: any) {
			throw this.toException(error, 'store');
		}
	}

	async getFileBuffer(key: string): Promise<Buffer> {
		try {
			const command = new GetObjectCommand({
				Bucket: this.config.s3.bucket,
				Key: key
			});
			const response = await this.client.send(command);
			const bytes = await response.Body!.transformToByteArray();
			return Buffer.from(bytes);
		} catch (error: any) {
			throw this.toException(error, 'read');
		}
	}

	async deleteFile(key: string) {
		try {
			const command = new DeleteObjectCommand({
				Bucket: this.config.s3.bucket,
				Key: key
			});

			await this.client.send(command);
		} catch (error: any) {
			throw new BadRequestException(error.message);
		}
	}

	/**
	 * Whether `key` exists; false for a missing key, a storage error throws.
	 * Some S3-compatible servers (RustFS) answer a HEAD for a missing key with
	 * 403 even when the key may list the bucket, so a 403 is settled by
	 * listing that exact key.
	 */
	async exists(key: string) {
		try {
			await this.client.send(
				new HeadObjectCommand({ Bucket: this.config.s3.bucket, Key: key })
			);
			return true;
		} catch (error: any) {
			const status = error?.$metadata?.httpStatusCode;
			if (error?.name === 'NotFound' || status === 404) return false;
			if (status === 403) return this.listed(key);
			throw this.toException(error, 'read');
		}
	}

	private async listed(key: string) {
		try {
			const { Contents } = await this.client.send(
				new ListObjectsV2Command({
					Bucket: this.config.s3.bucket,
					Prefix: key,
					MaxKeys: 1
				})
			);
			return Contents?.[0]?.Key === key;
		} catch (error: any) {
			throw this.toException(error, 'read');
		}
	}
}
