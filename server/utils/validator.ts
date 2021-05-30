import { IRating } from '../models/rating';

export const isPositiveSaveInteger = (toTest: string | number): boolean => {
	if (!toTest) {
		return false;
	}
	const num = Number(toTest);
	return Number.isSafeInteger(num) && num > 0;
};

export const isValideUsername = (username: string): boolean => {
	return typeof username === 'string' && username.length < 50;
};

export const isValidePassword = (password: string): boolean => {
	return typeof password === 'string' && /^(?=.*[A-Z])(?=.*[^A-Za-z0-9])(?=.*[0-9])(?=.*[a-z]).{6,}/.test(password);
};

export const isValideRating = (toTest: IRating, userId: number): boolean => {
	if (!toTest || !userId) {
		return false;
	}
	const num = Number(toTest[userId]);
	return num <= 5 && num >= 0;
};

// eslint-disable-next-line
export const tryParse = (toParse: any): any | undefined => {
	try {
		return JSON.parse(toParse);
	} catch {
		return;
	}
};