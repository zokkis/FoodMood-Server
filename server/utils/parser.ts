import { isStringArray, isValideSQLTimestamp } from './validator';

export const tryParse = <T>(toParse: unknown): T | undefined => {
	try {
		return typeof toParse === 'string' ? JSON.parse(toParse) : undefined;
	} catch {
		return;
	}
};

// @TODO: refactoring and testing

// { [key: string]: undefined | string | string[] | ParsedQs | ParsedQs[] }
// [lte], [gte], [exists], [regex], [before], and [after] -> gte smaller
// -> price= lte:15; price= gte:5 -> price= [lte:15, gte:5]

export type queryParmsType = 'lte' | 'gte' | /* 'exists' | */ 'regex' | 'before' | 'after' | 'eql';
export const queryParms: queryParmsType[] = ['lte', 'gte', /* 'exists', */ 'regex', 'before', 'after', 'eql'];

export type query = { [val: string]: { [val in queryParmsType]: string } };

export const queryParser = (toParse: { [key: string]: unknown }): query | undefined => {
	const keys = Object.keys(toParse || {});
	if (!keys.length) {
		return;
	}

	const ret: { [v: string]: { [v in queryParmsType]: string } } = {};
	keys.forEach(key => {
		const value = toParse[key];
		if (typeof value !== 'string' && !isStringArray(value)) {
			return;
		}
		const parsed = queryKeyValueParser(value);
		if (parsed && Object.keys(parsed || {}).length) {
			ret[key] = parsed as never;
		}
	});
	return ret;
};

const queryKeyValueParser = (value: string | string[]): { [val: string]: string } | undefined => {
	if (typeof value === 'string') {
		return queryStringParser(value);
	} else {
		let ret: { [val: string]: string } = {};
		value.forEach(val => {
			const conv = queryStringParser(val);
			if (conv) {
				ret = { ...ret, ...conv };
			}
		});
		return ret;
	}
};

const queryStringParser = (value: string): { [val: string]: string } | undefined => {
	const split = value.toLowerCase().split(':');
	if (split.length !== 2 || !queryParms.includes(split[0] as queryParmsType)) {
		return;
	}
	return { [split[0]]: split[1] };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getSQLAndData = (query: { [key: string]: unknown }, clazz: any): { sql: string; queryData: unknown[] } => {
	const parsedQuery = queryParser(query);
	const queryData: unknown[] = [];
	let sql = '';

	for (const key in parsedQuery) {
		if (key in clazz) {
			const queryKeys = parsedQuery[key];
			for (const queryKey in queryKeys) {
				const keyValue = queryKeys[queryKey as queryParmsType];
				if (keyValue && key === 'lastEdit' && !isValideSQLTimestamp(keyValue)) {
					continue;
				}
				sql += keyValue && sql.includes('WHERE') ? ' AND' : ' WHERE';

				switch (queryKey) {
					case 'lte':
					case 'before':
						sql += ` ${key} <= ?`;
						break;
					case 'gte':
					case 'after':
						sql += ` ${key} >= ?`;
						break;
					case 'regex':
						sql += ` ${key} REGEXP ?`;
						break;
					case 'eql':
						sql += ` ${key} = ?`;
						break;
					default:
						continue;
				}

				queryData.push(parsedQuery[key][queryKey]);
			}
		}
	}
	return { sql, queryData };
};
