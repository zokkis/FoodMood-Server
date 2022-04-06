import { IRating } from '../models/rating';

export const isPositiveSafeInteger = (int: unknown): boolean => {
	if (!int) {
		return false;
	}
	const num = Number(int);
	return Number.isSafeInteger(num) && num > 0;
};

export const isValideUsername = (username: unknown): boolean => {
	return typeof username === 'string' && username.length <= 500;
};

export const isValidePassword = (password: unknown): boolean => {
	return typeof password === 'string' && /^(?=.*[A-Z])(?=.*[^A-Za-z0-9])(?=.*[0-9])(?=.*[a-z]).{6,}/.test(password);
};

export const isValideRating = (toTest: IRating, userId: number): boolean => {
	if (!toTest || !userId) {
		return false;
	}
	const num = Number(toTest[userId]);
	return num <= 5 && num >= 0;
};

export const isValideSQLTimestamp = (stamp: unknown): boolean => {
	return typeof stamp === 'string' && /([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):([0-5]\d):([0-5]\d))/.test(stamp);
};

export const isStringArray = (value: unknown): value is string[] => {
	return Array.isArray(value) && value.every(val => typeof val === 'string');
};
