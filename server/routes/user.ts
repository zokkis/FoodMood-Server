import { Request, Response } from 'express';
import { LightUser } from '../models/user';
import { databaseQuerry, getEntitiesWithId, getUserByUsername, isValideSQLTimestamp } from '../utils/database';
import Logger from '../utils/logger';
import { errorHandler, RequestError } from '../utils/error';
import bcrypt from 'bcrypt';
import { OkPacket } from 'mysql';
import { deleteCachedUser, updateCachedUsersPropety } from '../utils/cachedUser';
import { ShoppingList } from '../models/shoppingList';
import { defaultHttpResponseMessages } from '../models/httpResponse';
import { isPositiveSaveInteger, isValidePassword, isValideUsername } from '../utils/validator';

const logger = new Logger('User');

export const register = (request: Request, response: Response): void => {
	if (!isValideUsername(request.body.username) || !isValidePassword(request.body.password)) {
		return errorHandler(response, 400);
	}

	getUserByUsername(request.body.username, false, true)
		.then(() => bcrypt.hash(request.body.password, 10))
		.then(salt => {
			const sqlRegisterUser = 'INSERT INTO users SET ?';
			return databaseQuerry(sqlRegisterUser, LightUser.getDBInsertUser({ ...request.body, password: salt }));
		})
		.then((user: OkPacket) => response.status(200).send({ userId: user.insertId }))
		.then(() => logger.log('Register success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const login = (request: Request, response: Response): void => {
	response.status(200).send(request.user);
};

export const changePassword = (request: Request, response: Response): void => {
	if (!isValidePassword(request.body.password)) {
		return errorHandler(response, 400);
	}

	let password: string;
	bcrypt.hash(request.body.password, 10)
		.then((salt: string) => {
			password = salt;
			const sqlChangePassword = 'UPDATE users SET password = ? WHERE username = ?';
			return databaseQuerry(sqlChangePassword, [salt, request.user.username]);
		})
		.then(() => updateCachedUsersPropety(request.user.username, 'password', password))
		.then(() => response.status(201).send(defaultHttpResponseMessages.get(201)))
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
			return databaseQuerry(sqlChangeUsername, [request.body.username, request.user.username]);
		})
		.then(() => updateCachedUsersPropety(request.user.username, 'username', request.body.username))
		.then(() => response.status(201).send(defaultHttpResponseMessages.get(201)))
		.then(() => logger.log('Changeusername success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const logout = (request: Request, response: Response): void => {
	deleteCachedUser(request.user.username);
	response.status(202).send(defaultHttpResponseMessages.get(202));
};

export const deleteUser = (request: Request, response: Response): void => {
	const sqlDeleteUser = 'DELETE FROM users WHERE username = ?';
	databaseQuerry(sqlDeleteUser, request.user.username)
		.then(serverStatus => {
			deleteCachedUser(request.user.username);
			if (serverStatus.affectedRows < 1) {
				throw new RequestError(500, 'User not deleted!');
			}
		})
		.then(() => response.status(202).send(defaultHttpResponseMessages.get(202)))
		.then(() => logger.log('Delete success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const getUsers = (request: Request, response: Response): void => {
	const isValideQuery = isValideSQLTimestamp(request.query.lastEdit);

	let sqlGetUsers = 'SELECT lastEdit, username, userId FROM users';
	sqlGetUsers += isValideQuery ? ' WHERE lastEdit >= ?' : '';
	databaseQuerry(sqlGetUsers, isValideQuery ? request.body.lastEdit : undefined)
		.then(users => response.status(200).send(users))
		.then(() => logger.log('GetUsers success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const getFavorites = (request: Request, response: Response): void => {
	if (!isPositiveSaveInteger(request.params.id)) {
		return errorHandler(response, 400);
	}
	const isValideQuery = isValideSQLTimestamp(request.query.lastEdit);

	let sqlGetFavorites = 'SELECT lastEdit, favorites FROM users WHERE userId = ?';
	sqlGetFavorites += isValideQuery ? ' AND WHERE lastEdit >= ?' : '';
	databaseQuerry(sqlGetFavorites, [request.params.id, isValideQuery ? request.query.lastEdit : undefined])
		.then(favs => response.status(200).send(favs))
		.then(() => logger.log('GetFavorites success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const addFavorite = async (request: Request, response: Response): Promise<void> => {
	const foodId = Number(request.body.foodId);
	if (!isPositiveSaveInteger(foodId)) {
		return errorHandler(response, 400);
	} else if (request.user.favorites.includes(foodId)) {
		return errorHandler(response, 400);
	} else if ((await getEntitiesWithId(foodId)).length !== 1) {
		return errorHandler(response, 400);
	}
	request.user.favorites.push(foodId);

	const sqlUpdateFavs = 'UPDATE users SET favorites = ? WHERE userId = ?';
	databaseQuerry(sqlUpdateFavs, [request.user.favorites, request.user.userId])
		.then(() => updateCachedUsersPropety(request.user.username, 'favorites', request.user.favorites))
		.then(() => response.status(201).send(defaultHttpResponseMessages.get(201)))
		.then(() => logger.log('Add fav success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const deleteFavorite = (request: Request, response: Response): void => {
	const foodId = Number(request.params.id);
	if (!isPositiveSaveInteger(foodId)) {
		return errorHandler(response, 400);
	}
	if (!request.user.favorites.includes(foodId)) {
		return errorHandler(response, 400);
	}

	const favorites = request.user.favorites.splice(request.user.favorites.findIndex(fav => fav === foodId));

	const sqlDeleteFav = 'UPDATE users SET favorites = ? WHERE userId = ?';
	databaseQuerry(sqlDeleteFav, [JSON.stringify(favorites), request.user.userId])
		.then(() => updateCachedUsersPropety(request.user.username, 'favorites', favorites))
		.then(() => response.status(202).send(defaultHttpResponseMessages.get(202)))
		.then(() => logger.log('Add fav success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const addShoppingList = async (request: Request, response: Response): Promise<void> => {
	const foodId = Number(request.body.foodId);
	const amount = Number(request.body.amount);
	if (!isPositiveSaveInteger(foodId) || !isPositiveSaveInteger(amount)) {
		return errorHandler(response, 400);
	}

	const shoppingList: ShoppingList[] = request.user.shoppingList;
	if (shoppingList.find(list => list.id === foodId)?.amount === amount) { // @TEST
		return errorHandler(response, 400);
	} else if ((await getEntitiesWithId(foodId)).length !== 1) {
		return errorHandler(response, 400);
	}

	const current = shoppingList.find(list => list.id === foodId);
	if (current) {
		current.amount = amount;
	} else {
		shoppingList.push({ id: foodId, amount });
	}

	const sqlUpdateList = 'UPDATE users SET shoppingList = ? WHERE userId = ?';
	databaseQuerry(sqlUpdateList, [JSON.stringify(shoppingList), request.user.userId])
		.then(() => updateCachedUsersPropety(request.user.username, 'shoppingList', shoppingList))
		.then(() => response.status(201).send(defaultHttpResponseMessages.get(201)))
		.then(() => logger.log('Add shoppingList success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const deleteShoppingList = (request: Request, response: Response): void => {
	const foodId = Number(request.body.foodId);
	if (!isPositiveSaveInteger(foodId)) {
		return errorHandler(response, 400);
	}

	const shoppingList = request.user.shoppingList;
	if (!shoppingList?.find(list => list.id === foodId)) {
		return errorHandler(response, 400);
	}

	shoppingList.splice(shoppingList.findIndex(list => list.id === foodId));

	const sqlDeleteList = 'UPDATE users SET shoppingList = ? WHERE userId = ?';
	databaseQuerry(sqlDeleteList, [JSON.stringify(shoppingList), request.user.userId])
		.then(() => updateCachedUsersPropety(request.user.username, 'shoppingList', shoppingList))
		.then(() => response.status(202).send(defaultHttpResponseMessages.get(202)))
		.then(() => logger.log('Delete shoppingList success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};