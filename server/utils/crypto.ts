import { randomBytes, createHash } from 'crypto';

export const generatePasswordWithSalt = (password: string, salt = randomBytes(128).toString('base64')): string => {
	return (
		salt +
		createHash('sha3-512')
			.update(salt + password)
			.digest('base64')
	);
};

export const compare = (pw: string, dbPw: string): boolean => {
	return dbPw === generatePasswordWithSalt(pw, dbPw.substring(0, dbPw.indexOf('=') + 1));
};
