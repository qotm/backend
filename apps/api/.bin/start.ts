import { Argv } from './helpers';

class Start extends Argv {
	private async getArgs() {
		const argv = await this.args
			.option('watch', {
				type: 'boolean',
				description:
					'Start the server in development mode with hot-reload (watch mode)',
				default: true,
				alias: 'w'
			})
			.option('debug', {
				type: 'boolean',
				description: 'Start the server in debug mode',
				default: false,
				alias: 'd'
			}).argv;
		return argv;
	}

	private async getCommand() {
		const args = await this.getArgs();
		const command = ['nest', 'start'];
		if (args.watch) {
			command.push('--watch');
		}
		if (args.debug) {
			command.push('--debug');
		}
		return command.join(' ');
	}

	async run() {
		this.clear();
		const command = await this.getCommand();
		this.exec(command);
	}

	static init() {
		return new Start();
	}
}

Start.init()
	.run()
	.catch((e) => console.error(e.message));
