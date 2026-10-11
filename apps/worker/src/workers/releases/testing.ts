import { randomBytes } from 'node:crypto';
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import config from '#app/config.js';
import type { DB } from '#app/db.js';
import { S3Storage, type PutOptions, type Storage } from '#lib/storage.js';

/**
 * Helpers for the releases integration tests: a storage that remembers what
 * it wrote (so the tests delete only their own objects), and a clean slate in
 * the test database.
 */
export class TrackedStorage implements Storage {
	readonly written = new Set<string>();
	private s3 = new S3Storage();
	readonly client = new S3Client({
		region: config.s3.region,
		...(config.s3.endpoint ? { endpoint: config.s3.endpoint } : {}),
		credentials: {
			accessKeyId: config.s3.accessKeyId,
			secretAccessKey: config.s3.secretAccessKey
		},
		forcePathStyle: true
	});

	async put(key: string, body: Uint8Array | string, options: PutOptions) {
		this.written.add(key);
		await this.s3.put(key, body, options);
	}

	async copy(from: string, to: string, options: PutOptions) {
		this.written.add(to);
		await this.s3.copy(from, to, options);
	}

	async delete(key: string) {
		await this.s3.delete(key);
	}

	async get(key: string) {
		const res = await this.client.send(
			new GetObjectCommand({ Bucket: config.s3.bucket, Key: key })
		);
		// Some S3-compatible stores return Cache-Control on HEAD only.
		const head = await this.client.send(
			new HeadObjectCommand({ Bucket: config.s3.bucket, Key: key })
		);
		return {
			bytes: Buffer.from(await res.Body!.transformToByteArray()),
			cacheControl: head.CacheControl,
			contentType: head.ContentType
		};
	}

	/** Deletes every object this storage wrote. */
	async cleanUp() {
		for (const key of this.written) {
			await this.client.send(
				new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key })
			);
		}
		this.written.clear();
	}
}

/** A prefix of its own per run, under the real `releases/`. */
export const testPrefix = () =>
	`${config.releases.prefix}/test-${randomBytes(4).toString('hex')}`;

/** Empties the tables a release reads and writes (the test database only). */
export async function resetReleaseTables(db: DB) {
	if (!config.database.url.includes(':5461/')) {
		throw new Error('Refusing to reset a database that is not the test one');
	}
	await db.$executeRawUnsafe(
		'TRUNCATE quotes, authors, sources, topics, releases, audit_logs CASCADE'
	);
}
