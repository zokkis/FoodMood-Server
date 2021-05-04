export const isPositiveSaveInteger = (toTest: string | number): boolean => {
	if (!toTest) {
		return false;
	}
	const num = Number(toTest);
	return Number.isInteger(num) && num > 0 && Number.isSafeInteger(num);
};

export const isValideUsername = (username: string): boolean => {
	return !!username && username.length < 50;
};

export const isValidePassword = (password: string): boolean => {
	return !!password && /^(?=.*[A-Z])(?=.*[^A-Za-z0-9])(?=.*[0-9])(?=.*[a-z]).{6,}/.test(password);
};

// eslint-disable-next-line
export const tryParse = (toParse: any): any | undefined => {
	try {
		return JSON.parse(toParse);
	} catch {
		return;
	}
};