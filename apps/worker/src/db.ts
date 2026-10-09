import { PrismaPg } from '@prisma/adapter-pg';
import config from '#app/config.js';
import { Prisma, PrismaClient } from '@qotm/db/client';
import type { PaginationOptions, PaginationMetaData } from '#app/types.js';
import { getPaginationInfo } from '#app/utils/helpers.js';

interface FindByEmailOptions {
	email: string;
	mode?: 'default' | 'insensitive' | undefined;
}

const setupExtensions = (db: PrismaClient) =>
	db.$extends({
		model: {
			$allModels: {
				async exists<
					Type,
					Arguments,
					Result extends Prisma.Result<Type, Arguments, 'count'>
				>(this: Type, where: Prisma.Args<Type, 'count'>['where']) {
					const ctx = Prisma.getExtensionContext(this) as any;
					const counts: Result = await ctx.count({ where });
					return Boolean(counts);
				},
				async paginate<
					Type,
					Args extends Omit<
						Prisma.Args<Type, 'findMany'>,
						'skip' | 'take' | 'cursor'
					>,
					Result extends Prisma.Result<Type, Args, 'findMany'>
				>(this: Type, args: Args & PaginationOptions) {
					const { limit, page, where, ...rest } = args;
					const {
						skip,
						take,
						page: currentPage
					} = getPaginationInfo({
						limit,
						page
					});
					const ctx = Prisma.getExtensionContext(this) as any;
					const [list, total]: [Result, number] = await Promise.all([
						ctx.findMany({ ...rest, skip, take, where }),
						ctx.count({ where })
					]);
					const meta: PaginationMetaData = {
						total,
						currentPage,
						pageSize: list.length,
						lastPage: Math.ceil(total / take) || 1
					};
					const result: [Result, PaginationMetaData] = [list, meta];
					return result;
				}
			},
			user: {
				async findById<
					Type,
					Args extends Omit<Prisma.UserFindUniqueArgs, 'where'>,
					Result extends Prisma.Result<Type, Args, 'findUnique'>
				>(this: Type, id: string, args?: Args): Promise<Result> {
					const ctx = Prisma.getExtensionContext(this) as any;
					return await ctx.findUnique({
						where: { id },
						...args
					});
				},
				async findByEmail<
					Type,
					Args extends Omit<Prisma.UserFindFirstArgs, 'where'>,
					Result extends Prisma.Result<Type, Args, 'findFirst'>
				>(
					this: Type,
					{ email, mode }: FindByEmailOptions,
					args?: Args
				): Promise<Result> {
					const ctx = Prisma.getExtensionContext(this) as any;
					return await ctx.findFirst({
						where: { email: { equals: email, mode: mode || 'default' } },
						...args
					});
				}
			}
		}
	});

export class DB extends PrismaClient {
	static #instance: DB | null = null;

	private constructor() {
		const connectionString = config.database.url;
		const adapter = new PrismaPg({ connectionString });
		super({ adapter });
	}

	public static getInstance(): DB {
		if (!DB.#instance) {
			DB.#instance = new DB();
		}
		return DB.#instance;
	}

	public static get instance() {
		return DB.getInstance();
	}

	/**
	 * Extended version of client with custom methods, etc.
	 */
	get $() {
		return setupExtensions(this);
	}

	async disconnect() {
		await this.$disconnect();
	}
}
