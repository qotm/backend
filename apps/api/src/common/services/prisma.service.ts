import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PaginationOptions } from 'common/types';
import { Prisma, PrismaClient } from '@qotm/db/client';
import { getPaginationInfo } from '../utils';
import type { PaginationMeta } from '../entity';
import { CustomConfigService } from './config.service';

type TableNames = Array<{ tablename: string }>;

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
					const meta: PaginationMeta = {
						total,
						currentPage,
						pageSize: list.length,
						lastPage: Math.ceil(total / take) || 1
					};
					const result: [Result, PaginationMeta] = [list, meta];
					return result;
				}
			}
		}
	});

@Injectable()
export class PrismaService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	constructor(private readonly c: CustomConfigService) {
		const adapter = new PrismaPg({
			connectionString: c.database.url
		});
		super({
			adapter,
			transactionOptions: {
				isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
				maxWait: 6000,
				timeout: 150000
			}
		});
	}

	get x() {
		return setupExtensions(this);
	}

	async onModuleInit() {
		await this.$connect();
	}

	async onModuleDestroy() {
		await this.$disconnect();
	}

	async truncate() {
		const tableNames = await this
			.$queryRaw<TableNames>`SELECT tablename from pg_tables where schemaname='public'`;

		const tables = tableNames
			.map(({ tablename }) => tablename)
			.filter((name) => name !== '_prisma_migrations')
			.map((name) => `"public"."${name}"`)
			.join(', ');

		try {
			await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
		} catch (error) {
			console.log({ error });
		}
	}
}
