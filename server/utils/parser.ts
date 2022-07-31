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

type OrdersType = 'ASC' | 'DESC';
const ORDERS: OrdersType[] = ['ASC', 'DESC'];

type TypesType = 'AND' | 'OR';
const TYPES: TypesType[] = ['AND', 'OR'];

type QueryPaginationType = 'limit' | 'offset';
const QUERY_PAGINATION: QueryPaginationType[] = ['limit', 'offset'];

type QueryParmsType = 'lte' | 'gte' | /* 'exists' | */ 'regex' | 'before' | 'after' | 'eql' | 'contains' | 'in' | 'order' | 'type';
const QUERY_PARAMS: QueryParmsType[] = ['lte', 'gte', /* 'exists', */ 'regex', 'before', 'after', 'eql', 'contains', 'in', 'order', 'type'];
const EXCLUDE_FROM_SQL_QUERY: QueryParmsType[] = ['in', 'order', 'type'];

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
		} else if (QUERY_PAGINATION.includes(key.toLowerCase() as QueryPaginationType) && isPositiveSafeInteger(value)) {
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
	if (split.length !== 2 || !QUERY_PARAMS.includes(split[0]) || !split[1]) {
		return;
	}
	return { [split[0]]: split[1] };
};

export const getSQLAndData = (
	query: { [key: string]: unknown },
	clazz: string[]
): { sql: string; queryData: (string | number | string[])[] } => {
	const parsedQuery = queryParser(query);
	if (!parsedQuery) {
		return { sql: '', queryData: [] };
	}

	const queryData: (string | number | string[])[] = [];
	let isWhereInSql = false;
	let sql = '';
	let orderSql = '';

	for (const key in parsedQuery) {
		const queryKeys = parsedQuery[key];
		if (typeof queryKeys !== 'string' && clazz.includes(key)) {
			for (const queryKey in queryKeys) {
				const keyValue = queryKeys[queryKey as QueryParmsType];
				if (key === 'lastEdit' && !isValideSQLTimestamp(keyValue)) {
					continue;
				}
				if (!EXCLUDE_FROM_SQL_QUERY.includes(queryKey as QueryParmsType)) {
					sql += isWhereInSql ? ` ${getTypesType(queryKeys.type?.toUpperCase())} ` : ' WHERE ';
					isWhereInSql = true;
				}

				switch (queryKey) {
					case 'lte':
					case 'before':
						sql += `${key} <= ?`;
						break;
					case 'gte':
					case 'after':
						sql += `${key} >= ?`;
						break;
					case 'regex':
						sql += `${key} REGEXP ?`;
						break;
					case 'eql':
						sql += `${key} = ?`;
						break;
					case 'contains':
						sql += `LOCATE(?, ${key}) > 0`;
						break;
					case 'in': {
						try {
							const pushDataArray = JSON.parse(queryKeys[queryKey] ?? '');
							if (Array.isArray(pushDataArray)) {
								sql += ` ${isWhereInSql ? getTypesType(queryKeys.type?.toUpperCase()) : 'WHERE'} ${key} IN (?)`;
								isWhereInSql = true;
								queryData.push(pushDataArray);
							}
							// eslint-disable-next-line no-empty
						} catch {}
						continue;
					}
					case 'order': {
						const data = queryKeys[queryKey]?.toUpperCase();
						if (ORDERS.includes(data as OrdersType)) {
							orderSql += `${orderSql ? ',' : ' ORDER BY'} ${key} ${data}`;
						}
						continue;
					}
					default:
						continue;
				}

				const pushData = queryKeys[queryKey];
				pushData && queryData.push(pushData);
			}
		}
	}

	if (orderSql) {
		sql += orderSql;
	}

	QUERY_PAGINATION.forEach(data => {
		const parsedData = parsedQuery[data];
		if (isPositiveSafeInteger(parsedData)) {
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

const getTypesType = (type?: string): string => {
	return type?.toUpperCase() ?? TYPES[0];
};
