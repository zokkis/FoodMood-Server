import fs from 'fs';
import Logger from './logger';

let logger: Logger;
setTimeout(() => (logger = new Logger('FileAndFolder')));

export const mkdirIfNotExist = (path: string, callback?: () => void): void => {
	fs.access(path, notExist => {
		if (notExist) {
			fs.mkdir(path, { recursive: true }, err => {
				if (err) {
					logger?.error(err);
				}
				callback?.();
			});
		} else {
			callback?.();
		}
	});
};

export const deletePath = (path: string, callback?: (err?: NodeJS.ErrnoException | null) => void): void => {
	fs.access(path, err => {
		if (err) {
			fs.rm(path, { recursive: true, force: true }, err => callback?.(err));
		} else {
			callback?.();
		}
	});
};
