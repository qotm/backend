import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import config from '#app/config.js';

export interface PutOptions {
	contentType: string;
	cacheControl?: string;
}

/** What jobs need from object storage; tests pass an in-memory one. */
export interface Storage {
	put(
		key: string,
		body: Uint8Array | string,
		options: PutOptions
	): Promise<void>;
	get(key: string): Promise<Uint8Array>;
	delete(key: string): Promise<void>;
}

/** Content-addressed or versioned keys never change: cache them for a year. */
export const IMMUTABLE = 'public, max-age=31536000, immutable';

/** The project's S3-compatible store (path-style, as the API's media client). */
export class S3Storage implements Storage {
	private client: S3Client;

	constructor(private bucket = config.s3.bucket) {
		this.client = new S3Client({
			region: config.s3.region,
			...(config.s3.endpoint ? { endpoint: config.s3.endpoint } : {}),
			credentials: {
				accessKeyId: config.s3.accessKeyId,
				secretAccessKey: config.s3.secretAccessKey
			},
			forcePathStyle: true,
			requestHandler: {
				connectionTimeout: 5_000,
				requestTimeout: 30_000,
				throwOnRequestTimeout: true
			},
			maxAttempts: 3
		});
	}

	async put(key: string, body: Uint8Array | string, options: PutOptions) {
		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: body,
				ContentType: options.contentType,
				...(options.cacheControl ? { CacheControl: options.cacheControl } : {})
			})
		);
	}

	async get(key: string) {
		const res = await this.client.send(
			new GetObjectCommand({ Bucket: this.bucket, Key: key })
		);
		return res.Body!.transformToByteArray();
	}

	async delete(key: string) {
		await this.client.send(
			new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
		);
	}
}
