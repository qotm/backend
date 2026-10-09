import { User } from '@qotm/db/client';

/**
 * Namespaced Redis keys for hash-cached entities.
 *
 * Adding a cached entity means three matching edits: a `Type` member (the hash
 * key), a `TypeEntityMap` entry (what a member deserializes to), and an `ID`
 * builder (the field key). They are kept in one file precisely so a mismatch
 * shows up here rather than as a runtime cache miss.
 */
export namespace Key {
	type IdType = number | string;

	export enum Type {
		Users = 'users'
	}

	export type TypeKey = keyof typeof Type;

	type TypeEntityMap = {
		Users: User;
	};
	export type EntityMap<T extends TypeKey> = TypeEntityMap[T];

	const ID: Record<Type, <T = IdType>(id: T) => string> = {
		[Type.Users]: (id) => `uid:${id}`
	};

	export const id = <T = IdType>(typeKey: TypeKey, key: T) =>
		ID[Type[typeKey]](key);
}
