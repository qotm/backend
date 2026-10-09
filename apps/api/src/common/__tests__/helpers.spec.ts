import { Gen } from '@test/factory/gen';
import * as helper from 'common/utils';

describe('Helpers', () => {
	describe('getRandomArrayItem', () => {
		it('should return an array item', () => {
			const arr = [35, 55, 78, 854, 784, 885, 4415];
			const item = helper.getRandomArrayItem(arr);
			expect(item).not.toBeUndefined();
			expect(arr).toContain(item);
		});
	});

	describe('parseBoolean', () => {
		it('should return true', () => {
			expect(helper.parseBoolean('true')).toBe(true);
			expect(helper.parseBoolean('   true   ')).toBe(true);
			expect(helper.parseBoolean('1')).toBe(true);
			expect(helper.parseBoolean(1)).toBe(true);
			expect(helper.parseBoolean('yes')).toBe(true);
		});

		it('should return false', () => {
			expect(helper.parseBoolean('false')).toBe(false);
			expect(helper.parseBoolean('   false   ')).toBe(false);
			expect(helper.parseBoolean('0')).toBe(false);
			expect(helper.parseBoolean(0)).toBe(false);
			expect(helper.parseBoolean('no')).toBe(false);
		});
	});

	describe('getPaginationInfo', () => {
		it('should return default object', () => {
			const info = helper.getPaginationInfo({});
			expect(info.skip).toBe(0);
			expect(info.take).toBe(10);
			expect(info.page).toBe(1);
		});

		it('should return object with page size of 5', () => {
			const info = helper.getPaginationInfo({ limit: 5 });
			expect(info.skip).toBe(0);
			expect(info.take).toBe(5);
			expect(info.page).toBe(1);
		});

		it('should return object specified current page and page size', () => {
			const info = helper.getPaginationInfo({ limit: 4, page: 10 });
			expect(info.skip).toBe(36);
			expect(info.take).toBe(4);
			expect(info.page).toBe(10);
		});
	});

	describe('lowercase', () => {
		it('should return trimmed string', () => {
			expect(helper.lowercase('  Hello World  ')).toBe('hello world');
		});

		it('should return lowercase string', () => {
			expect(helper.lowercase('Hello World')).toBe('hello world');
		});

		it('should return capitalized (only first letter) string', () => {
			expect(helper.lowercase('Hello World', true)).toBe('Hello world');
		});
	});

	describe('isValidUUID', () => {
		it('should return TRUE for valid UUID v4 string', () => {
			expect(helper.isValidUUID(Gen.uuid())).toBe(true);
		});

		it('should return FALSE for invalid UUID v4 string', () => {
			expect(helper.isValidUUID('not_a_valid_uuid')).toBe(false);
		});
	});

	describe('isInEnum', () => {
		it('should return TRUE when value exists in enum', () => {
			// Using UploadFolder enum from helper.Enum
			const { Enum } = helper;
			expect(
				helper.isInEnum(
					[Enum.UploadFolder.AVATARS, Enum.UploadFolder.UPLOAD],
					Enum.UploadFolder.AVATARS as any
				)
			).toBe(true);
		});

		it('should return FALSE when value does not exist in enum', () => {
			const { Enum } = helper;
			expect(
				helper.isInEnum(
					[Enum.UploadFolder.AVATARS, Enum.UploadFolder.UPLOAD],
					'invalid' as any
				)
			).toBe(false);
		});
	});

	describe('createSortObject', () => {
		it('should create sort objects from simple sort string', () => {
			const sort = 'name,-createdAt';
			const result = helper.createSortObject(sort);

			expect(result).toEqual([{ name: 'asc' }, { createdAt: 'desc' }]);
		});

		it('should create nested sort objects when nesting is provided', () => {
			const result = helper.createSortObject({
				sort: 'name,-posts',
				nesting: [
					{
						key: 'user',
						values: ['posts']
					}
				]
			});

			expect(result).toEqual([{ name: 'asc' }, { user: { posts: 'desc' } }]);
		});
	});
});
