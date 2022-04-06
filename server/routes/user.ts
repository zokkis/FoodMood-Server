import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { OkPacket } from 'mysql';
import { defaultHttpResponseMessages } from '../models/httpResponse';
import { ShoppingList } from '../models/shoppingList';
import { LightUser, User } from '../models/user';
import { deleteCachedUser, updateCachedUsersPropety } from '../utils/cachedUser';
import { databaseQuerry, getEntityWithId, getUserByUsername } from '../utils/database';
import { errorHandler, RequestError } from '../utils/error';
import Logger from '../utils/logger';
import { getSQLAndData } from '../utils/parser';
import { isPositiveSafeInteger, isValidePassword, isValideSQLTimestamp, isValideUsername } from '../utils/validator';

const logger = new Logger('User');

export const register = (request: Request, response: Response): void => {
	if (
		request.body.password !== request.body.passwordRepeat ||
		!isValideUsername(request.body.username) ||
		!isValidePassword(request.body.password) ||
		!isValidePassword(request.body.passwordRepeat)
	) {
		return errorHandler(response, 400);
	}

	getUserByUsername(request.body.username, false, true)
		.then(() => bcrypt.hash(request.body.password, 10))
		.then(salt =>
			databaseQuerry<OkPacket>('INSERT INTO users SET ?', LightUser.getDBInsertUser({ username: request.body.username, password: salt }))
		)
		.then(user => response.status(201).json({ userId: user.insertId }))
		.then(() => logger.log('Register success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const login = (request: Request, response: Response): void => {
	response.status(200).json(request.user);
};

export const changePassword = (request: Request, response: Response): void => {
	if (!isValidePassword(request.body.password)) {
		return errorHandler(response, 400);
	}

	let password: string;
	bcrypt
		.hash(request.body.password, 10)
		.then(salt => {
			password = salt;
			const sqlChangePassword = 'UPDATE users SET password = ? WHERE username = ?';
			return databaseQuerry<OkPacket>(sqlChangePassword, [salt, request.user.username]);
		})
		.then(() => updateCachedUsersPropety(request.user.username, 'password', password))
		.then(() => response.status(201).json(defaultHttpResponseMessages.get(201)))
		.then(() => logger.log('Changepassword success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const changeUsername = (request: Request, response: Response): void => {
	if (!isValideUsername(request.body.username)) {
		return errorHandler(response, 400);
	}

	getUserByUsername(request.body.username, false, true)
		.then(() => {
			const sqlChangeUsername = 'UPDATE users SET username = ? WHERE username = ?';
			return databaseQuerry<OkPacket>(sqlChangeUsername, [request.body.username, request.user.username]);
		})
		.then(() => updateCachedUsersPropety(request.user.username, 'username', request.body.username))
		.then(() => response.status(201).json(defaultHttpResponseMessages.get(201)))
		.then(() => logger.log('Changeusername success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const logout = (request: Request, response: Response): void => {
	deleteCachedUser(request.user.username);
	response.status(202).json(defaultHttpResponseMessages.get(202));
};

export const deleteUser = (request: Request, response: Response): void => {
	const sqlDeleteUser = 'DELETE FROM users WHERE username = ?';
	databaseQuerry<OkPacket>(sqlDeleteUser, request.user.username)
		.then(serverStatus => {
			deleteCachedUser(request.user.username);
			if (serverStatus.affectedRows < 1) {
				throw new RequestError(500, 'User not deleted!');
			}
		})
		.then(() => response.status(202).json(defaultHttpResponseMessages.get(202)))
		.then(() => logger.log('Delete success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const getUsers = (request: Request, response: Response): void => {
	const { sql, queryData } = getSQLAndData(request.query, new LightUser(-1, ''));
	console.log(sql, queryData);

	databaseQuerry<User[]>('SELECT username, userId FROM users' + sql, queryData)
		.then(users => response.status(200).json(users))
		.then(() => logger.log('GetUsers success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const getFavorites = (request: Request, response: Response): void => {
	if (!isPositiveSafeInteger(request.params.id)) {
		return errorHandler(response, 400);
	}
	const isValideQuery = isValideSQLTimestamp(request.query.lastEdit);

	let sqlGetFavorites = 'SELECT favorites FROM users WHERE userId = ?';
	sqlGetFavorites += isValideQuery ? ' AND WHERE lastEdit >= ?' : '';
	databaseQuerry<User[]>(sqlGetFavorites, [request.params.id, isValideQuery ? request.query.lastEdit : undefined])
		.then(favs => response.status(200).json(favs))
		.then(() => logger.log('GetFavorites success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const addFavorite = (request: Request, response: Response): void => {
	const foodId = Number(request.body.foodId);
	if (!isPositiveSafeInteger(foodId) || request.user.favorites.includes(foodId)) {
		return errorHandler(response, 400);
	}
	request.user.favorites.push(foodId);

	getEntityWithId(foodId)
		.then(() => {
			const sqlUpdateFavs = 'UPDATE users SET favorites = ? WHERE userId = ?';
			return databaseQuerry<OkPacket>(sqlUpdateFavs, [JSON.stringify(request.user.favorites), request.user.userId]);
		})
		.then(() => updateCachedUsersPropety(request.user.username, 'favorites', request.user.favorites))
		.then(() => response.status(201).json(defaultHttpResponseMessages.get(201)))
		.then(() => logger.log('Add fav success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const deleteFavorite = (request: Request, response: Response): void => {
	const foodId = Number(request.params.id);
	if (!isPositiveSafeInteger(foodId) || !request.user.favorites.includes(foodId)) {
		return errorHandler(response, 400);
	}

	request.user.favorites.splice(request.user.favorites.findIndex(fav => fav === foodId));

	const sqlDeleteFav = 'UPDATE users SET favorites = ? WHERE userId = ?';
	databaseQuerry<OkPacket>(sqlDeleteFav, [JSON.stringify(request.user.favorites), request.user.userId])
		.then(() => updateCachedUsersPropety(request.user.username, 'favorites', request.user.favorites))
		.then(() => response.status(202).json(defaultHttpResponseMessages.get(202)))
		.then(() => logger.log('Delete fav success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const addShoppingList = (request: Request, response: Response): void => {
	const foodId = Number(request.body.foodId);
	const amount = Number(request.body.amount);
	if (!isPositiveSafeInteger(foodId) || !isPositiveSafeInteger(amount)) {
		return errorHandler(response, 400);
	}

	const shoppingList: ShoppingList[] = request.user.shoppingList;
	if (shoppingList.find(list => list.id === foodId)?.amount === amount) {
		return errorHandler(response, 400);
	}

	const current = shoppingList.find(list => list.id === foodId);
	if (current) {
		current.amount = amount;
	} else {
		shoppingList.push({ id: foodId, amount });
	}

	getEntityWithId(foodId)
		.then(() => {
			const sqlUpdateList = 'UPDATE users SET shoppingList = ? WHERE userId = ?';
			return databaseQuerry<OkPacket>(sqlUpdateList, [JSON.stringify(shoppingList), request.user.userId]);
		})
		.then(() => updateCachedUsersPropety(request.user.username, 'shoppingList', shoppingList))
		.then(() => response.status(201).json(defaultHttpResponseMessages.get(201)))
		.then(() => logger.log('Add shoppingList success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const deleteShoppingList = (request: Request, response: Response): void => {
	const foodId = Number(request.body.foodId);
	if (!isPositiveSafeInteger(foodId)) {
		return errorHandler(response, 400);
	}

	const shoppingList = request.user.shoppingList;
	if (!shoppingList?.find(list => list.id === foodId)) {
		return errorHandler(response, 400);
	}

	shoppingList.splice(shoppingList.findIndex(list => list.id === foodId));

	const sqlDeleteList = 'UPDATE users SET shoppingList = ? WHERE userId = ?';
	databaseQuerry<OkPacket>(sqlDeleteList, [JSON.stringify(shoppingList), request.user.userId])
		.then(() => updateCachedUsersPropety(request.user.username, 'shoppingList', shoppingList))
		.then(() => response.status(202).json(defaultHttpResponseMessages.get(202)))
		.then(() => logger.log('Delete shoppingList success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};
