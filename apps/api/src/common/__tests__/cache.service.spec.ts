import { TestBed } from '@suites/unit';
import { vi } from 'vitest';
import { User } from '@qotm/db/client';
import { Entity } from '@test/factory/entity';
import { CacheService } from 'common/services';

vi.mock('ioredis');

describe('CacheService', () => {
	let service: CacheService;
	const on = vi.spyOn;

	beforeAll(async () => {
		const { unit } = await TestBed.solitary(CacheService).compile();
		service = unit;
	});

	afterAll(async () => {
		await service.disconnect();
		vi.restoreAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('store', () => {
		describe('when EXP is undefined', () => {
			it('should store string data with default expiry of 24hrs', async () => {
				const key = 'example-key';
				const data = 'exampleData';
				on(service.db, 'setex');

				await service.store(key, data);
				expect(service.db.setex).toHaveBeenCalled();
				expect(service.db.setex).toHaveBeenCalledWith(
					key,
					service.DEFAULT_EXPIRY,
					data
				);
			});

			it('should store object data with default expiry of 24hrs', async () => {
				const key = 'testKey';
				const testData = { id: 1, name: 'Test' };
				on(service.db, 'setex');

				await service.store(key, testData);
				expect(service.db.setex).toHaveBeenCalled();
				expect(service.db.setex).toHaveBeenCalledWith(
					key,
					service.DEFAULT_EXPIRY,
					JSON.stringify(testData)
				);
			});
		});

		describe('otherwise', () => {
			const EXP = 86400 * 3;

			it('should store string data with specified EXP', async () => {
				const key = 'example-key';
				const data = 'exampleData';
				on(service.db, 'setex');

				await service.store(key, data, EXP);
				expect(service.db.setex).toHaveBeenCalled();
				expect(service.db.setex).toHaveBeenCalledWith(key, EXP, data);
			});

			it('should store object data with specified EXP', async () => {
				const key = 'testKey';
				const testData = { id: 1, name: 'Test' };
				on(service.db, 'setex');

				await service.store(key, testData, EXP);
				expect(service.db.setex).toHaveBeenCalled();
				expect(service.db.setex).toHaveBeenCalledWith(
					key,
					EXP,
					JSON.stringify(testData)
				);
			});
		});
	});

	describe('hashStore', () => {
		it('should call hset with correct arguments', async () => {
			const user = Entity.user.build();
			on(service.db, 'hset');

			await service.hashStore('Users', user);
			expect(service.db.hset).toHaveBeenCalled();
			expect(service.db.hset).toHaveBeenCalledWith(
				'users',
				`uid:${user.id}`,
				JSON.stringify(user)
			);
		});
	});

	describe('fetch', () => {
		describe('when data is not available', () => {
			it('should return null', async () => {
				on(service.db, 'get').mockResolvedValue(null);

				const response = await service.fetch('example-key');
				expect(service.db.get).toHaveBeenCalled();
				expect(service.db.get).toHaveBeenCalledWith('example-key');
				expect(response).toBeNull();
			});
		});

		describe('otherwise', () => {
			it('should return string data', async () => {
				const data = 'example-data';
				on(service.db, 'get').mockResolvedValue(data);

				const response = await service.fetch('example-key');
				expect(service.db.get).toHaveBeenCalled();
				expect(service.db.get).toHaveBeenCalledWith('example-key');
				expect(response).not.toBe(null);
				expect(typeof response).toBe('string');
				expect(response).toEqual(data);
			});

			it('should return object data', async () => {
				const data = Entity.user.build();
				on(service.db, 'get').mockResolvedValue(JSON.stringify(data));

				const response = await service.fetch<User>('example-key');
				expect(service.db.get).toHaveBeenCalled();
				expect(service.db.get).toHaveBeenCalledWith('example-key');
				expect(response).not.toBe(null);
				expect(typeof response).not.toBe('string');
				expect(response?.name).toEqual(data.name);
			});
		});
	});

	describe('hashFetch', () => {
		describe('when data is not available', () => {
			it('should return null', async () => {
				on(service.db, 'hget').mockResolvedValue(null);

				const response = await service.hashFetch('Users', 25);
				expect(service.db.hget).toHaveBeenCalled();
				expect(service.db.hget).toHaveBeenCalledWith('users', 'uid:25');
				expect(response).toBe(null);
			});
		});

		describe('otherwise', () => {
			it('should return object', async () => {
				const data = Entity.user.build({ id: '25' });
				on(service.db, 'hget').mockResolvedValue(JSON.stringify(data));

				const response = await service.hashFetch('Users', 25);
				expect(service.db.hget).toHaveBeenCalled();
				expect(service.db.hget).toHaveBeenCalledWith('users', 'uid:25');
				expect(response).not.toBe(null);
				// User ids are strings; the cached JSON round-trips them unchanged.
				expect(response?.id).toBe('25');
			});
		});
	});

	describe('hashFetchAll', () => {
		describe('when data is not available', () => {
			it('should return []', async () => {
				on(service.db, 'hvals').mockResolvedValue([]);

				const response = await service.hashFetchAll('Users');
				expect(service.db.hvals).toHaveBeenCalled();
				expect(service.db.hvals).toHaveBeenCalledWith('users');
				expect(response).toHaveLength(0);
			});
		});

		describe('otherwise', () => {
			it('should return list of objects', async () => {
				const data = Entity.user.buildList(10);
				on(service.db, 'hvals').mockResolvedValue(
					data.map((item) => JSON.stringify(item))
				);

				const response = await service.hashFetchAll('Users');
				expect(service.db.hvals).toHaveBeenCalled();
				expect(service.db.hvals).toHaveBeenCalledWith('users');
				expect(response).toHaveLength(10);
			});
		});
	});

	describe('hashDelete', () => {
		it('should delete data with specified key', async () => {
			on(service.db, 'hdel');

			await service.hashDelete('Users', 25);
			expect(service.db.hdel).toHaveBeenCalled();
			expect(service.db.hdel).toHaveBeenCalledWith('users', 'uid:25');
		});
	});

	describe('deleteKey', () => {
		it('should delete data with specified key', async () => {
			on(service.db, 'del');

			await service.deleteKey('Users');
			expect(service.db.del).toHaveBeenCalled();
			expect(service.db.del).toHaveBeenCalledWith('users');
		});
	});
});
