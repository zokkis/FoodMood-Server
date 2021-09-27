import fs from 'fs';
import { isProd, LOG_PATH } from './constans';
import { mkdirIfNotExist } from './fileAndFolder';

mkdirIfNotExist(LOG_PATH);
const logStream = fs.createWriteStream(LOG_PATH + '/logs.log', { flags: 'a' });
const warnStream = fs.createWriteStream(LOG_PATH + '/warns.log', { flags: 'a' });
const errorStream = fs.createWriteStream(LOG_PATH + '/erros.log', { flags: 'a' });

export default class Logger {
	constructor(public prefix: string) {
	}

	log(...message: unknown[]): void {
		const prefix = this.getLoggingPrefix('\x1b[37m', 'LOG');
		!isProd && console.log(prefix, ...message, '\x1b[0m');
		this.appendTo(logStream, prefix, message);
	}

	warn(...warn: unknown[]): void {
		const prefix = this.getLoggingPrefix('\x1b[33m', 'WARN');
		!isProd && console.warn(prefix, ...warn, '\x1b[0m');
		this.appendTo(warnStream, prefix, warn);
	}

	error(...error: unknown[]): void {
		const prefix = this.getLoggingPrefix('\x1b[31m', 'ERROR');
		!isProd && console.error(prefix, ...error, '\x1b[0m');
		this.appendTo(errorStream, prefix, error);
	}

	private getLoggingPrefix(color: string, loggingType: string): string {
		const date = new Date();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');
		const milliSeconds = String(date.getMilliseconds()).padStart(3, '0');
		return `${color}[${date.getFullYear()}/${month}/${day}, ${hours}:${minutes}:${seconds}.${milliSeconds}] [${this.prefix}] [${loggingType}]`;
	}

	private appendTo(stream: fs.WriteStream, prefix: string, arr: unknown[]): void {
		stream.write('\n' + prefix);
		arr.forEach(a => {
			const toWrite = typeof a !== 'object' ? a : JSON.stringify(a);
			stream.write(' ' + toWrite);
		});
	}
}