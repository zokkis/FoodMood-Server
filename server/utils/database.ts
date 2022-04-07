import mysql from 'mysql';
import sqlConfigs from '../../private_files/sqlConfigs.json';
import { Category } from '../models/category';
import { Food } from '../models/food';
import { User } from '../models/user';
import Logger from '../utils/logger';
import { getCachedUserById, getCachedUserByName } from './cachedUser';
import { RequestError } from './error';

const logger = new Logger('Database');
const dbPool = mysql.createPool(sqlConfigs);

export const databaseQuerry = <T>(sql: string, data: unknown = undefined): Promise<T> => {
	return new Promise((resolve, reject) =>
		dbPool.getConnection((err, connection) => {
			if (err) {
				logger.error(err);
				return reject(err);
			}
			connection.query(sql, data, (err, result) => {
				if (err) {
					logger.error(err);
					return reject(err);
				}
				resolve(result);
			});
		})
	);
};

export const getEntitiesWithId = (id: number | string): Promise<Food[]> => {
	const sqlGetFoods = 'SELECT * FROM entity WHERE entityId = ?';
	return databaseQuerry<Food[]>(sqlGetFoods, id);
};

export const getEntityWithId = (id: number | string, showErrorOnEmpty = true, showErrorOnFill = false): Promise<Food> => {
	const sqlGetFoods = 'SELECT * FROM entity WHERE entityId = ?';
	return databaseQuerry<Food[]>(sqlGetFoods, id).then(foods => {
		if ((foods.length === 0 && showErrorOnEmpty) || (foods.length > 0 && showErrorOnFill)) {
			throw new RequestError(404);
		}
		return foods[0];
	});
};

export const getUserByUsername = (username: string, showErrorOnEmpty = true, showErrorOnFill = false): Promise<User> => {
	const cachedUser = getCachedUserByName(username);

	/* eslint-disable indent */
	return cachedUser
		? new Promise(resolve => resolve(cachedUser))
		: databaseQuerry<User[]>('SELECT * FROM users WHERE username = ?', username) //
				.then(users => {
					if ((users.length === 0 && showErrorOnEmpty) || (users.length > 0 && showErrorOnFill)) {
						throw new RequestError(showErrorOnEmpty ? 401 : 409);
					}
					return users[0]; // User.getDefaultUser(users[0]);
				});
	/* eslint-enable indent */
};

export const getUserById = (id: number): Promise<User> => {
	const cachedUser = getCachedUserById(id);

	/* eslint-disable indent */
	return cachedUser
		? new Promise(resolve => resolve(cachedUser))
		: databaseQuerry<User[]>('SELECT * FROM users WHERE userId = ?', id) //
				.then(users => {
					if (users.length !== 1) {
						throw new RequestError(404);
					}
					return users[0]; // User.getDefaultUser(users[0]);
				});
	/* eslint-enable indent */
};

export const getCategoryById = (id: number | string | undefined, showErrorOnEmpty = true, showErrorOnFill = false): Promise<Category> => {
	/* eslint-disable indent */
	return !id
		? new Promise((resolve, reject) => (showErrorOnEmpty ? reject() : resolve(new Category(-1, ''))))
		: databaseQuerry<Category[]>('SELECT * FROM categories WHERE categoryId = ?', id) //
				.then(categories => {
					if ((categories.length === 0 && showErrorOnEmpty) || (categories.length > 0 && showErrorOnFill)) {
						throw new RequestError(showErrorOnEmpty ? 404 : 409);
					}
					return categories[0];
				});
	/* eslint-enable indent */
};
