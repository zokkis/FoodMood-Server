import { isPositiveSafeInteger, isStringArray, isValideSQLTimestamp } from './validator';

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

type QueryPaginationType = 'limit' | 'offset';
const queryPagination: QueryPaginationType[] = ['limit', 'offset'];

type QueryParmsType = 'lte' | 'gte' | /* 'exists' | */ 'regex' | 'before' | 'after' | 'eql';
const queryParms: QueryParmsType[] = ['lte', 'gte', /* 'exists', */ 'regex', 'before', 'after', 'eql'];

type QueryData = { [val in QueryParmsType]?: string }; // idk if this '?' is a good idea
type Query = { [val: string]: QueryData | string };

const queryParser = (toParse: { [key: string]: unknown }): Query | undefined => {
	const keys = Object.keys(toParse || {});
	if (!keys.length) {
		return;
	}

	const ret: Query = {};
	keys.forEach(key => {
		const value = toParse[key];
		if (typeof value !== 'string' && !isStringArray(value)) {
			return;
		}
		const parsed = queryKeyValueParser(value);
		if (parsed && Object.keys(parsed).length) {
			ret[key] = parsed;
		} else if (queryPagination.includes(key.toLowerCase() as QueryPaginationType) && isPositiveSafeInteger(value)) {
			ret[key.toLowerCase()] = value as QueryData;
		}
	});
	return ret;
};

const queryKeyValueParser = (value: string | string[]): QueryData | undefined => {
	if (typeof value === 'string') {
		return queryStringParser(value);
	} else {
		let ret = {} as QueryData;
		value.forEach(val => {
			const conv = queryStringParser(val);
			if (conv) {
				ret = { ...ret, ...conv };
			}
		});
		return ret;
	}
};

const queryStringParser = (value: string): QueryData | undefined => {
	const split = value.toLowerCase().split(':') as [QueryParmsType, string];
	if (split.length !== 2 || !queryParms.includes(split[0]) || !split[1]) {
		return;
	}
	return { [split[0]]: split[1] };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getSQLAndData = (query: { [key: string]: unknown }, clazz: any): { sql: string; queryData: (string | number)[] } => {
	const parsedQuery = queryParser(query);
	if (!parsedQuery) {
		return { sql: '', queryData: [] };
	}

	const queryData: (string | number)[] = [];
	let sql = '';

	for (const key in parsedQuery) {
		const queryKeys = parsedQuery[key];
		if (typeof queryKeys !== 'string' && key in clazz) {
			for (const queryKey in queryKeys) {
				const keyValue = queryKeys[queryKey as QueryParmsType];
				if (keyValue && key === 'lastEdit' && !isValideSQLTimestamp(keyValue)) {
					continue;
				}
				sql += keyValue && sql.includes('WHERE') ? ' AND' : ' WHERE';

				switch (queryKey) {
					case 'lte':
					case 'before':
						sql += ' ' + key + ' <= ?';
						break;
					case 'gte':
					case 'after':
						sql += ' ' + key + ' >= ?';
						break;
					case 'regex':
						sql += ' ' + key + ' REGEXP ?';
						break;
					case 'eql':
						sql += ' ' + key + ' = ?';
						break;
					default:
						continue;
				}

				const parsedQueryData = parsedQuery[key];
				const pushData = typeof parsedQueryData === 'string' ? parsedQueryData : parsedQueryData[queryKey];
				pushData && queryData.push(pushData);
			}
		}
	}
	queryPagination.forEach(data => {
		const parsedData = parsedQuery[data];
		if (typeof parsedData === 'string') {
			switch (data) {
				case 'limit':
					sql += ' LIMIT ?';
					break;
				case 'offset':
					sql += ' OFFSET ?';
					break;
				default:
					return;
			}
			queryData.push(Number(parsedData));
		}
	});
	return { sql, queryData };
};
