import { Argv, Env } from './helpers';

interface ArgsResponse {
	cmd: string;
	env: Env;
	name?: string;
}

// The schema and migrations live in packages/db (@qotm/db); the env files live
// here, because the API owns the database. So Prisma runs in that workspace with
// this app's env loaded first.
const ENV_FILES: Record<Env, string> = {
	dev: '.env',
	test: '.env.test',
	prod: '.env.production'
};

class CommandBuilder {
	private command: string[];

	private constructor(private env: Env = 'dev') {
		this.command = [`dotenv -e ${ENV_FILES[env]} --`];
	}

	static init(env: Env) {
		return new CommandBuilder(env);
	}

	private prisma(...args: string[]) {
		this.command.push('yarn workspace @qotm/db prisma', ...args);
		return this;
	}

	generate() {
		// Generates and compiles the client both apps import as @qotm/db/*.
		this.command = ['yarn workspace @qotm/db build'];
		return this;
	}

	push() {
		// push targets test/prod (reseeded), so accept column drops non-interactively.
		return this.prisma('db push --accept-data-loss');
	}

	reset() {
		// Prisma 7 no longer seeds after a reset; re-seed with `yarn db:seed`.
		return this.prisma('migrate reset --force');
	}

	studio() {
		return this.prisma('studio --browser none --port 5025');
	}

	seed() {
		this.command.push('tsx seeders');
		return this;
	}

	build() {
		return this.command.join(' ');
	}
}

class Database extends Argv {
	private async getArgs(): Promise<ArgsResponse> {
		const argv = await this.args
			.option('command', {
				type: 'string',
				description: 'Specify the command to run',
				choices: ['generate', 'push', 'seed', 'reset', 'studio'],
				default: 'generate',
				alias: 'c'
			})
			.option('name', {
				type: 'string',
				description:
					'Use a specific name for the migration (only for migrate or migrate:create command)',
				alias: 'n'
			}).argv;
		return {
			cmd: argv.command,
			env: this.getEnv(argv.env),
			name: argv.name
		};
	}

	private async getCommand() {
		const { env, cmd, name } = await this.getArgs();
		const command = CommandBuilder.init(env);
		if (cmd === 'push') {
			return command.push().build();
		}

		if (cmd === 'seed') {
			return command.seed().build();
		}

		if (cmd === 'reset') {
			if (['test', 'prod'].includes(env)) {
				this.err(
					'Reset command is not allowed in test or production environment'
				);
			}
			return command.reset().build();
		}

		if (cmd === 'studio') {
			if (env === 'prod') {
				this.err('Studio command is not allowed in production environment');
			}
			return command.studio().build();
		}

		return command.generate().build();
	}

	async run() {
		this.clear();
		const command = await this.getCommand();
		this.exec(command);
	}

	static init() {
		return new Database();
	}
}

Database.init()
	.run()
	.catch((e) => console.error(e.message));
