import Logger from '../utils/logger';
import mysql from 'mysql';
import sqlConfigs from '../../private_files/sqlConfigs.json';
import { Food } from '../models/food';

const logger = new Logger('Database');
const db = mysql.createConnection(sqlConfigs);

db.connect(err => {
	if (err) {
		throw err;
	}
	logger.log('MySQL connected...');
});

// eslint-disable-next-line
export const databaseQuerry = (sql: string, data: any = undefined): Promise<any> => {
	return new Promise((resolve, reject) =>
		db.query(sql, data, (err, result) => err ? reject(err) : resolve(result)));
};

export const getEntityWithId = (id: number | string): Promise<Food[]> => {
	const sqlGetFoods = 'SELECT * FROM entity WHERE entityId = ?';
	return databaseQuerry(sqlGetFoods, id);
};

export const isValideSQLTimestamp = (stamp: string): boolean => {
	return typeof stamp === 'string' && /([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):([0-5]\d):([0-5]\d))/.test(stamp);
};