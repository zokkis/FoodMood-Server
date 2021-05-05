import Logger from '../utils/logger';
import mysql from 'mysql';
import sqlConfigs from '../../private_files/sqlConfigs.json';
import { Food } from '../models/food';
import { User } from '../models/user';
import { getCachedUserById, getCachedUserByName } from './cachedUser';
import { RequestError } from './error';
import { Category } from '../models/category';

const logger = new Logger('Database');
const db = mysql.createConnection(sqlConfigs);

db.connect(err => {
	if (err) { throw err; }
	logger.log('MySQL connected...');
});

// eslint-disable-next-line
export const databaseQuerry = (sql: string, data: any = undefined): Promise<any> => {
	return new Promise((resolve, reject) =>
		db.query(sql, data, (err, result) => err ? reject(err) : resolve(result)));
};

export const getEntitiesWithId = (id: number | string): Promise<Food[]> => {
	const sqlGetFoods = 'SELECT * FROM entity WHERE entityId = ?';
	return databaseQuerry(sqlGetFoods, id);
};

export const getEntityWithId = (id: number | string, errorOnEmpty = true, errorOnFill = false): Promise<Food> => {
	const sqlGetFoods = 'SELECT * FROM entity WHERE entityId = ?';
	return databaseQuerry(sqlGetFoods, id)
		.then((foods: Food[]) => {
			if ((foods.length === 0 && errorOnEmpty) || (foods.length > 0 && errorOnFill)) {
				throw new RequestError(400);
			}
			return foods[0];
		});
};

// eslint-disable-next-line
export const isValideSQLTimestamp = (stamp: any): boolean => {
	return typeof stamp === 'string' && /([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):([0-5]\d):([0-5]\d))/.test(stamp);
};

export const getUserByUsername = async (username: string, errorOnEmpty = true, errorOnFill = false): Promise<User> => {
	return getCachedUserByName(username) || databaseQuerry('SELECT * FROM users WHERE username like ?', username)
		.then((users: User[]) => {
			if ((users.length === 0 && errorOnEmpty) || (users.length > 0 && errorOnFill)) {
				throw new RequestError(400);
			}
			return User.getDefaultUser(users[0]);
		});
};

export const getUserById = async (id: number): Promise<User> => {
	return getCachedUserById(id) || databaseQuerry('SELECT * FROM users WHERE userId = ?', id)
		.then((users: User[]) => {
			if (users.length !== 1) {
				throw new RequestError(400);
			}
			return User.getDefaultUser(users[0]);
		});
};

export const getCategoryById = async (id: number | string | undefined, errorOnEmpty = true, errorOnFill = false): Promise<Category | undefined> => {
	return !id
		? undefined
		: databaseQuerry('SELECT * FROM categories WHERE categoryId = ?', id)
			.then((categories: Category[]) => {
				if ((categories.length === 0 && errorOnEmpty) || (categories.length > 0 && errorOnFill)) {
					throw new RequestError(400);
				}
				return categories[0];
			});
};