import fs from 'fs';

export const mkdirIfNotExist = (path: string): void => {
	if (!fs.existsSync(path)) {
		fs.mkdirSync(path, { recursive: true });
	}
};

export const deletePath = (path: string): void => {
	fs.rm(path, { recursive: true, force: true }, err => {
		if (err) { throw err; }
	});
};