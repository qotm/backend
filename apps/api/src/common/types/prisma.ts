import { PrismaClient } from '@qotm/db/client';

export type PrismaModelName = keyof Omit<
	PrismaClient,
	| '$on'
	| '$connect'
	| '$disconnect'
	| '$extends'
	| '$use'
	| '$queryRaw'
	| '$executeRaw'
	| '$executeRawUnsafe'
	| '$queryRawUnsafe'
	| '$transaction'
	| symbol
>;

export type PrismaModel<Name extends PrismaModelName> = PrismaClient[Name];
