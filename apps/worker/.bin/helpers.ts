import shell from 'shelljs';
import yargs, { Argv as IArgv } from 'yargs';
import { hideBin } from 'yargs/helpers';

export type Env = 'dev' | 'prod' | 'test';

export abstract class Argv {
	protected args: IArgv<any>;

	constructor() {
		this.args = yargs(hideBin(process.argv))
			.help('help')
			.alias('help', 'h')
			.option('env', {
				type: 'string',
				description: 'Specify the environment to use',
				choices: [
					'dev',
					'development',
					'prod',
					'production',
					'test',
					'testing'
				],
				default: 'dev',
				alias: 'e'
			});
	}

	getEnv(env: string): Env {
		return ['test', 'testing'].includes(env)
			? 'test'
			: ['prod', 'production'].includes(env)
				? 'prod'
				: 'dev';
	}

	clear() {
		console.clear();
	}

	err(message: string) {
		throw new Error(`❌ ${message}`);
	}

	exec(command: string) {
		shell.exec(command);
	}
}
