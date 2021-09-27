import mysql from 'mysql';
import sqlConfigs from '../../private_files/sqlConfigs.json';
import { Category } from '../models/category';
import { Food } from '../models/food';
import { User } from '../models/user';
import Logger from '../utils/logger';
import { getCachedUserById, getCachedUserByName } from './cachedUser';
import { RequestError } from './error';

const logger = new Logger('Database');
const db = mysql.createConnection(sqlConfigs);

db.connect(err => {
	if (err) {
		throw err;
	}
	logger.log('MySQL connected...');
});

export const databaseQuerry = <T>(sql: string, data: unknown = undefined): Promise<T> => {
	return new Promise((resolve, reject) =>
		db.query(sql, data, (err, result) => {
			if (err) {
				logger.error(err);
				return reject(err);
			}
			resolve(result);
		})
	);
};

export const getEntitiesWithId = (id: number | string): Promise<Food[]> => {
	const sqlGetFoods = 'SELECT * FROM entity WHERE entityId = ?';
	return databaseQuerry<Food[]>(sqlGetFoods, id);
};

export const getEntityWithId = (id: number | string, errorOnEmpty = true, errorOnFill = false): Promise<Food> => {
	const sqlGetFoods = 'SELECT * FROM entity WHERE entityId = ?';
	return databaseQuerry<Food[]>(sqlGetFoods, id)
		.then(foods => {
			if ((foods.length === 0 && errorOnEmpty) || (foods.length > 0 && errorOnFill)) {
				throw new RequestError(404);
			}
			return foods[0];
		});
};

export const getUserByUsername = (username: string, errorOnEmpty = true, errorOnFill = false): Promise<User> => {
	const cachedUser = getCachedUserByName(username);

	return cachedUser
		? new Promise(resolve => resolve(cachedUser))
		: databaseQuerry<User[]>('SELECT * FROM users WHERE username like ?', username)
			.then(users => {
				if ((users.length === 0 && errorOnEmpty) || (users.length > 0 && errorOnFill)) {
					throw new RequestError(errorOnEmpty ? 404 : 409);
				}
				return users[0]; // User.getDefaultUser(users[0]);
			});
};

export const getUserById = (id: number): Promise<User> => {
	const cachedUser = getCachedUserById(id);

	return cachedUser
		? new Promise(resolve => resolve(cachedUser))
		: databaseQuerry<User[]>('SELECT * FROM users WHERE userId = ?', id)
			.then(users => {
				if (users.length !== 1) {
					throw new RequestError(404);
				}
				return users[0]; // User.getDefaultUser(users[0]);
			});
};

export const getCategoryById = (id: number | string | undefined, errorOnEmpty = true, errorOnFill = false): Promise<Category> => {
	return !id
		? new Promise((_resolve, reject) => reject())
		: databaseQuerry<Category[]>('SELECT * FROM categories WHERE categoryId = ?', id)
			.then(categories => {
				if ((categories.length === 0 && errorOnEmpty) || (categories.length > 0 && errorOnFill)) {
					throw new RequestError(errorOnEmpty ? 404 : 409);
				}
				return categories[0];
			});
};