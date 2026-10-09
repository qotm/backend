import fs from 'node:fs';
import shell from 'shelljs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const getArg = async () => {
	const argv = await yargs(hideBin(process.argv))
		.option('env', {
			alias: 'e',
			description: 'The environment [dev, test, prod, etc.]',
			type: 'string',
			choices: [
				'dev',
				'development',
				'test',
				'testing',
				'staging',
				'prod',
				'production'
			],
			default: 'development'
		})
		.help()
		.alias('help', 'h').argv;

	return ['dev', 'development'].includes(argv.env)
		? 'dev'
		: ['test', 'testing'].includes(argv.env)
			? 'test'
			: ['prod', 'production'].includes(argv.env)
				? 'prod'
				: 'staging';
};

const getEnvFile = (env: string) => {
	const envMap: Record<string, string> = {
		dev: '.env',
		test: '.env.test',
		staging: '.env.staging',
		prod: '.env.production'
	};

	return envMap[env];
};

// The project ID identifies one organisation's vault, so it is read from the
// environment rather than baked in — a hardcoded value would follow every copy
// of this scaffold to projects it has nothing to do with.
const PROJECT_ID = process.env.INFISICAL_PROJECT_ID;
const SECRET_PATH = process.env.INFISICAL_PATH ?? '/';

const getCmd = (env: string) => {
	if (!PROJECT_ID) {
		throw new Error('INFISICAL_PROJECT_ID is not set — nothing to fetch from.');
	}
	return `infisical export --projectId="${PROJECT_ID}" --path=${SECRET_PATH} --env=${env}`;
};

const log = (env: string) => console.log(`Fetching secrets for '${env}'...`);

(async () => {
	const env = await getArg();
	const command = getCmd(env);
	const file = getEnvFile(env);
	log(env);
	// Export first and write only on success: a shell `>` redirect would empty
	// the existing file before infisical had the chance to fail.
	const result = shell.exec(command, { silent: true });
	if (result.code !== 0) {
		throw new Error(result.stderr.trim() || `infisical exited with ${result.code}`);
	}
	fs.writeFileSync(file, result.stdout);
	console.log(`Wrote ${file}`);
})().catch((err: unknown) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
