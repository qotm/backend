import { Injectable, OnModuleDestroy } from '@nestjs/common';
import IoRedis from 'ioredis';
import { CustomConfigService } from './config.service';
import { User } from '@qotm/db/client';
// import { RoleFull } from 'common/types';
import { Key } from '../utils';

@Injectable()
export class CacheService implements OnModuleDestroy {
	readonly db: IoRedis;
	readonly DEFAULT_EXPIRY = 86400; // 24 hours

	constructor(private cfg: CustomConfigService) {
		this.db = new IoRedis({ ...cfg.redis });
	}

	async disconnect() {
		await this.db.disconnect();
	}

	async onModuleDestroy() {
		await this.db.disconnect();
	}

	async truncate() {
		await this.db.flushall();
	}

	/** Delete a plain string key (no-op if it does not exist). */
	async delete(key: string) {
		await this.db.del(key);
	}

	async store<T = string>(key: string, data: T, exp = this.DEFAULT_EXPIRY) {
		if (typeof data === 'string') {
			await this.db.setex(key, exp, data);
			return;
		}

		const stringified = JSON.stringify(data);
		await this.db.setex(key, exp, stringified);
	}

	async hashStore<T extends { id: string | number }>(
		key: Key.TypeKey,
		item: T
	) {
		await this.db.hset(
			Key.Type[key],
			Key.id(key, item.id),
			JSON.stringify(item)
		);
	}

	/**
	 * Atomic counter with a fixed window — returns the count after incrementing.
	 * The TTL is set only on first hit, so the window is fixed (not sliding).
	 */
	async incr(key: string, windowSeconds: number): Promise<number> {
		const count = await this.db.incr(key);
		if (count === 1) await this.db.expire(key, windowSeconds);
		return count;
	}

	async fetch<T = string>(key: string): Promise<T | null> {
		const cached = await this.db.get(key);
		if (!cached) return null;

		try {
			return JSON.parse(cached) as T;
		} catch {
			return cached as T;
		}
	}

	async hashFetch<Key extends Key.TypeKey, ID extends string | number>(
		key: Key,
		id: ID
	): Promise<Key.EntityMap<Key> | null> {
		const result = await this.db.hget(Key.Type[key], Key.id(key, id));
		return result ? (JSON.parse(result) as Key.EntityMap<Key>) : null;
	}

	async hashFetchAll<Key extends Key.TypeKey>(
		key: Key
	): Promise<Key.EntityMap<Key>[]> {
		const result = await this.db.hvals(Key.Type[key]);
		return result.map((item) => JSON.parse(item) as Key.EntityMap<Key>);
	}

	async hashDelete<Key extends Key.TypeKey, ID extends string | number>(
		key: Key,
		id: ID
	): Promise<void> {
		await this.db.hdel(Key.Type[key], Key.id(key, id));
	}

	async deleteKey(key: Key.TypeKey) {
		await this.db.del(Key.Type[key]);
	}

	/**
	 * Bulk-load a set of entities into their hash in one round trip. Model new
	 * bulk loaders on this — a per-item `hset` in a loop costs one round trip
	 * each, which is what the pipeline avoids.
	 */
	async storeUsers(list: User[]) {
		const pipeline = this.db.pipeline();
		for (const item of list) {
			pipeline.hset(
				Key.Type.Users,
				Key.id('Users', item.id),
				JSON.stringify(item)
			);
		}
		await pipeline.exec();
	}
}
