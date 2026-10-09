import { createRequire } from 'node:module';
import pino, { stdTimeFunctions, levels } from 'pino';
import config from '#app/config.js';

const PINO_CONSOLE_TARGET = {
	target: 'pino-pretty',
	options: {
		ignore: 'pid,hostname',
		translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
		singleLine: true,
		colorize: true
	}
};

const PINO_FILE_TARGET = {
	target: 'pino/file',
	options: {
		destination: 'logs/qotm-worker.log',
		mkdir: true
	}
};

const PINO_CONSOLE_TARGET_PROD = {
	target: 'pino/file',
	options: {
		destination: 1
	}
};

// pino-pretty is a dev dependency, so the production image doesn't have it.
// Pretty-print only where it's installed; anywhere else (an image run with an
// APP_ENV other than production, say) log JSON to stdout instead of crashing.
const prettyAvailable = (() => {
	try {
		createRequire(import.meta.url).resolve('pino-pretty');
		return true;
	} catch {
		return false;
	}
})();

const logger = pino({
	level: config.app.logLevel,
	transport:
		config.app.env === 'production' || !prettyAvailable
			? { targets: [PINO_CONSOLE_TARGET_PROD, PINO_FILE_TARGET] }
			: { targets: [PINO_CONSOLE_TARGET, PINO_FILE_TARGET] },
	base: {
		service: 'qotm-worker',
		env: config.app.env
	},
	timestamp: stdTimeFunctions.isoTime,
	mixin(_mergeObject, level) {
		return { levelLabel: levels.labels[level] };
	}
});

export default logger;
