import { dev } from '$app/environment';
import pino, { type Logger, type LoggerOptions } from 'pino';
import type { PrettyOptions } from 'pino-pretty';

const loggerConfig: LoggerOptions = {
	level: 'info',
	base: undefined,
	timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
	messageKey: 'message',
	errorKey: 'error',
	formatters: {
		level: (label: string) => ({ level: label })
	}
};

if (dev) {
	loggerConfig.transport = {
		target: 'pino-pretty',
		options: {
			colorize: true,
			singleLine: true,
			messageKey: 'message',
			timestampKey: 'timestamp'
		} as PrettyOptions
	};
}

export const logger = pino(loggerConfig);

export function createLogger(context: string, parentLogger: Logger = logger) {
	return parentLogger.child({ context }, { msgPrefix: `[${context}] ` });
}
