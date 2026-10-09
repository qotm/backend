/**
 * pino-pretty is a dev dependency, so the production image doesn't have it.
 * Pretty-print only where it's installed; anywhere else (an image run with an
 * APP_ENV other than production, say) log JSON to stdout instead of crashing.
 */
export const PRETTY_AVAILABLE = (() => {
	try {
		require.resolve('pino-pretty');
		return true;
	} catch {
		return false;
	}
})();

export const PINO_CONSOLE_TARGET = {
	target: 'pino-pretty',
	options: {
		ignore: 'pid,hostname',
		translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
		singleLine: true,
		colorize: true
	}
};

export const PINO_FILE_TARGET = {
	target: 'pino/file',
	options: {
		destination: 'logs/app.log',
		mkdir: true
	}
};

export const PINO_CONSOLE_TARGET_PROD = {
	target: 'pino/file',
	options: {
		destination: 1
	}
};
