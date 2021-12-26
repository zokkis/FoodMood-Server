import fs from 'fs';
import { isProd, LOG_PATH } from './constans';
import { mkdirIfNotExist } from './fileAndFolder';

mkdirIfNotExist(LOG_PATH);
const logStream = fs.createWriteStream(LOG_PATH + '/logs.log', { flags: 'a' });
const warnStream = fs.createWriteStream(LOG_PATH + '/warns.log', { flags: 'a' });
const errorStream = fs.createWriteStream(LOG_PATH + '/erros.log', { flags: 'a' });

export default class Logger {
	constructor(
		public prefix: string //
	) {}

	log(...message: unknown[]): void {
		const date = new Date();

		new Promise(resolve => {
			const prefix = this.getLoggingPrefix('\x1b[37m', 'LOG', date);
			!isProd && console.log(prefix, ...message, '\x1b[0m');
			this.appendTo(logStream, prefix, message);
			resolve(null);
		});
	}

	warn(...warn: unknown[]): void {
		const date = new Date();

		new Promise(resolve => {
			const prefix = this.getLoggingPrefix('\x1b[33m', 'WARN', date);
			!isProd && console.warn(prefix, ...warn, '\x1b[0m');
			this.appendTo(warnStream, prefix, warn);
			resolve(null);
		});
	}

	error(...error: unknown[]): void {
		const date = new Date();

		new Promise(resolve => {
			const prefix = this.getLoggingPrefix('\x1b[31m', 'ERROR', date);
			!isProd && console.error(prefix, ...error, '\x1b[0m');
			this.appendTo(errorStream, prefix, error);
			resolve(null);
		});
	}

	private getLoggingPrefix(color: string, loggingType: string, date?: Date): string {
		const loggingDate = date || new Date();
		const month = String(loggingDate.getMonth() + 1).padStart(2, '0');
		const day = String(loggingDate.getDate()).padStart(2, '0');
		const hours = String(loggingDate.getHours()).padStart(2, '0');
		const minutes = String(loggingDate.getMinutes()).padStart(2, '0');
		const seconds = String(loggingDate.getSeconds()).padStart(2, '0');
		const milliSeconds = String(loggingDate.getMilliseconds()).padStart(3, '0');
		return `${color}[${loggingDate.getFullYear()}/${month}/${day}, ${hours}:${minutes}:${seconds}.${milliSeconds}] [${
			this.prefix
		}] [${loggingType}]`;
	}

	private appendTo(stream: fs.WriteStream, prefix: string, arr: unknown[]): void {
		stream.write('\n' + prefix);
		arr.forEach(a => {
			const toWrite = typeof a !== 'object' ? a : JSON.stringify(a);
			stream.write(' ' + toWrite);
		});
	}
}
