import { Request, Response } from 'express';
import { LightUser } from '../models/user';
import { databaseQuerry, getEntitiesWithId, isValideSQLTimestamp } from '../utils/database';
import Logger from '../utils/logger';
import { errorHandler } from '../utils/util';
import bcrypt from 'bcrypt';
import { OkPacket } from 'mysql';
import { deleteCachedUser, updateCachedUsersPropety } from '../utils/cachedUser';
import { ShoppingList } from '../models/shoppingList';

const logger = new Logger('User');

export const register = (request: Request, response: Response): void => {
	if (!request.body?.username || !request.body.password) {
		return errorHandler('Missing username or password!', response);
	}

	bcrypt.hash(request.body.password, 10)
		.then(salt => {
			const sqlRegisterUser = 'INSERT INTO users SET ?';
			return databaseQuerry(sqlRegisterUser, LightUser.getDBUser({ ...request.body, password: salt }));
		})
		.then((user: OkPacket) => response.status(200).send({ userId: user.insertId }))
		.then(() => logger.log('Register success!'))
		.catch(err => errorHandler(err, response));
};

export const login = (request: Request, response: Response): void => {
	response.status(200).send(request.user);
};

export const changePassword = (request: Request, response: Response): void => {
	if (!request.body?.password) {
		return errorHandler('Empty password!', response);
	}

	let password: string;
	bcrypt.hash(request.body.password, 10)
		.then((salt: string) => {
			password = salt;
			const sqlChangePassword = 'UPDATE users SET password = ? WHERE username = ?';
			return databaseQuerry(sqlChangePassword, [salt, request.user?.username]);
		})
		.then(() => updateCachedUsersPropety(request.user?.username, 'password', password))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Changepassword success!'))
		.catch(err => errorHandler(err, response));
};

export const changeUsername = (request: Request, response: Response): void => {
	if (!request.body?.username) {
		return errorHandler('Empty username!', response);
	}

	const sqlChangeUsername = 'UPDATE users SET username = ? WHERE username = ?';
	databaseQuerry(sqlChangeUsername, [request.body.username, request.user?.username])
		.then(() => updateCachedUsersPropety(request.user?.username, 'username', request.body.username))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Changeusername success!'))
		.catch(err => errorHandler(err, response));
};

export const logout = (request: Request, response: Response): void => {
	deleteCachedUser(request.user?.username);
	response.sendStatus(200);
};

export const deleteUser = (request: Request, response: Response): void => {
	const sqlDeleteUser = 'DELETE FROM users WHERE username = ?';
	databaseQuerry(sqlDeleteUser, request.user?.username)
		.then(serverStatus => {
			if (serverStatus.affectedRows < 1) {
				throw new Error('User not deleted!');
			}
			deleteCachedUser(request.user?.username);
		})
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Delete success!'))
		.catch(err => errorHandler(err, response));
};

export const getUsers = (request: Request, response: Response): void => {
	let sqlGetUsers = 'SELECT lastEdit, username, userId FROM users';
	sqlGetUsers += isValideSQLTimestamp(request.query?.lastEdit as string) ? ' WHERE lastEdit >= ?' : '';
	databaseQuerry(sqlGetUsers, request.body.lastEdit)
		.then(users => response.status(200).send(users))
		.then(() => logger.log('GetUsers success!'))
		.catch(err => errorHandler(err, response));
};

export const getFavorites = (request: Request, response: Response): void => {
	const userId = request.params?.id;
	if (!userId) {
		return errorHandler('No userId!', response);
	}

	let sqlGetFavorites = 'SELECT lastEdit, favorites FROM users WHERE userId = ?';
	sqlGetFavorites += isValideSQLTimestamp(request.query?.lastEdit as string) ? ' WHERE lastEdit >= ?' : '';
	databaseQuerry(sqlGetFavorites, [userId, request.query?.lastEdit])
		.then(favs => response.status(200).send(favs))
		.then(() => logger.log('GetFavorites success!'))
		.catch(err => errorHandler(err, response));
};

export const addFavorite = async (request: Request, response: Response): Promise<void> => {
	const foodId = request.body?.foodId;
	if (!foodId) {
		return errorHandler('No foodId to add!', response);
	}
	if (request.user?.favorites.includes(foodId)) {
		return errorHandler('Id already a fav!', response);
	} else if ((await getEntitiesWithId(foodId)).length === 0) {
		return errorHandler('No entity for this id!', response);
	}
	request.user?.favorites.push(foodId);

	const sqlUpdateFavs = 'UPDATE users SET favorites = ? WHERE userId = ?';
	databaseQuerry(sqlUpdateFavs, [request.user?.favorites, request.user?.userId])
		.then(() => updateCachedUsersPropety(request.user?.username, 'favorites', request.user?.favorites))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Add fav success!'))
		.catch(err => errorHandler(err, response));
};

export const deleteFavorite = (request: Request, response: Response): void => {
	const foodId = Number.parseInt(request.params?.id);
	if (!foodId) {
		return errorHandler('No foodId to delete!', response);
	}
	if (!request.user?.favorites.includes(foodId)) {
		return errorHandler('Id not in favs!', response);
	}

	const favorites = request.user?.favorites.splice(request.user?.favorites.findIndex(fav => fav === foodId));

	const sqlDeleteFav = 'UPDATE users SET favorites = ? WHERE userId = ?';
	databaseQuerry(sqlDeleteFav, [JSON.stringify(favorites), request.user.userId])
		.then(() => updateCachedUsersPropety(request.user?.username, 'favorites', favorites))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Add fav success!'))
		.catch(err => errorHandler(err, response));
};

export const addShoppingList = async (request: Request, response: Response): Promise<void> => {
	const foodId = request.body?.foodId;
	const amount = request.body?.amount;
	if (!foodId || !amount) {
		return errorHandler('No foodId or amount to add!', response);
	}

	if (request.user?.shoppingList.find(list => list.id === foodId)?.amount === request.body.amount) {
		return errorHandler('Id already in shoppingList!', response);
	} else if ((await getEntitiesWithId(foodId)).length === 0) {
		return errorHandler('No entity for this id!', response);
	}

	const shoppingList: ShoppingList[] = request.user?.shoppingList || [];
	const current = shoppingList.find(list => list.id === foodId);
	if (current) {
		current.amount = request.body.amount;
	} else {
		shoppingList.push({ id: request.body.foodId, amount: request.body.amout });
	}

	const sqlUpdateList = 'UPDATE users SET shoppingList = ? WHERE userId = ?';
	databaseQuerry(sqlUpdateList, [JSON.stringify(shoppingList), request.user?.userId])
		.then(() => updateCachedUsersPropety(request.user?.username, 'shoppingList', shoppingList))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Add shoppingList success!'))
		.catch(err => errorHandler(err, response));
};

export const deleteShoppingList = (request: Request, response: Response): void => {
	const foodId = Number.parseInt(request.body?.foodId);
	if (!foodId) {
		return errorHandler('No foodId to delete!', response);
	}

	const shoppingList = request.user?.shoppingList;
	if (!shoppingList?.find(list => list.id === foodId)) {
		return errorHandler('Id isn\'t in shoppingList!', response);
	}

	shoppingList.splice(shoppingList.findIndex(list => list.id === foodId));

	const sqlDeleteList = 'UPDATE users SET shoppingList = ? WHERE userId = ?';
	databaseQuerry(sqlDeleteList, [JSON.stringify(shoppingList), request.user?.userId])
		.then(() => updateCachedUsersPropety(request.user?.username, 'shoppingList', shoppingList))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Delete shoppingList success!'))
		.catch(err => errorHandler(err, response));
};