import fs from 'fs';

export const mkdirIfNotExist = (path: string): void => {
	if (!fs.existsSync(path)) {
		fs.mkdirSync(path, { recursive: true });
	}
}