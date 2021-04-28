import Logger from '../utils/logger';
import mysql from 'mysql';
import sqlConfigs from '../../private_files/sqlConfigs.json';

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