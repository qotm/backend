import {
	PaginationInfo,
	PaginationOptions,
	SortNesting,
	SortObjectArg
} from 'common/types';

/**
 *	Check if an enum includes specified value
 * @param type - Type of the enum to check
 * @param value - Value to check
 */
export const isInEnum = <T extends ArrayLike<unknown>, U extends keyof T>(
	type: T,
	value: U
) => Object.values(type).includes(value);

export const getPaginationInfo = (
	options: PaginationOptions
): PaginationInfo => {
	const page = options.page && options.page > 0 ? options.page : 1;
	const take = options.limit && options.limit > 0 ? options.limit : 10;
	return {
		skip: (page - 1) * take,
		take,
		page
	};
};

/**
 * Parse a value as boolean
 * @param value - value to check
 * @param defaultValue - default value to return for an invalid `value`
 */
export const parseBoolean = (
	value: string | number | null | undefined,
	defaultValue = false
): boolean => {
	if (value === '' || value === null || value === undefined) {
		return defaultValue;
	}

	if (typeof value === 'string') {
		if (value.trim() === '') {
			return defaultValue;
		}

		const toCheck = value.trim().toLowerCase();
		if (toCheck === '1' || toCheck === 'true' || toCheck === 'yes') {
			return true;
		}
	}

	if (typeof value === 'number') {
		if (value >= 1) {
			return true;
		}
	}

	return false;
};

/**
 * It takes an array of any type and returns a random item from that array
 * @param arr - The array to get a random item from.
 */
export const getRandomArrayItem = <T>(arr: T[]) =>
	arr[Math.floor(Math.random() * arr.length)];

/**
 * "Convert a string to lowercase, optionally capitalizing the first letter."
 *
 * @param str - The string to be converted to lowercase.
 * @param capitalizeFirstLetter - If true, the first letter of the string will
 * be capitalized.
 */
export const lowercase = (str: string, capitalizeFirstLetter = false) => {
	const result = str.trim().toLocaleLowerCase();

	return capitalizeFirstLetter
		? result.replace(/^[a-z]/, (letter) => letter.toUpperCase())
		: result;
};

export const isValidUUID = (value: string) => {
	const uuidPattern =
		/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

	return uuidPattern.test(value);
};

/**
 * Create sort objects from a string
 * @param sort - the string to convert to a sort object
 * @returns the sort object
 */
export function createSortObject<T = any>(
	options: SortObjectArg | undefined
): T[];
export function createSortObject<T = any>(sort?: string): T[];
export function createSortObject<T = any>(
	param: SortObjectArg | string | undefined
): T[] {
	const list: T[] = [];

	let sort: string | undefined;
	let nesting: SortNesting[] | undefined;

	if (!param) return list;

	if (typeof param === 'string') {
		sort = param;
	} else {
		sort = param.sort;
		nesting = param.nesting;
	}

	if (!sort) return list;

	const keys = sort.split(',');
	keys.forEach((key) => {
		const name = key.replace(/^-/, '');
		const value = key.startsWith('-') ? 'desc' : 'asc';
		const obj: T = { [name]: value } as T;

		if (!nesting || !nesting.length) {
			list.push(obj);
		} else {
			const nest = nesting.find((n) => n.values.includes(name));
			if (!nest) {
				list.push(obj);
			} else {
				list.push({ [nest.key]: obj } as T);
			}
		}
	});

	return list;
}
