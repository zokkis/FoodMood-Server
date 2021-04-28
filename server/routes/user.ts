import { Request, Response } from 'express';
import { User } from '../models/user';
import { databaseQuerry } from '../utils/database';
import Logger from '../utils/logger';
import { errorHandler } from '../utils/util';
import bcrypt from 'bcrypt';
import { OkPacket } from 'mysql';
import { deleteCachedUser, updateCachedUser } from '../utils/cachedUser';

const logger = new Logger('User');

export const register = (request: Request, response: Response): void => {
	logger.log('Register');
	if (!request.body?.username || !request.body.password) {
		return errorHandler('Missing username or password!', response);
	}

	bcrypt.hash(request.body.password, 10)
		.then(salt => {
			const sqlRegisterUser = 'INSERT INTO users SET ?';
			return databaseQuerry(sqlRegisterUser, { ...User.getDefaultUser({ ...request.body, password: salt }) });
		})
		.then((user: OkPacket) => response.status(200).send({ userId: user.insertId }))
		.then(() => logger.log('Register success!'))
		.catch(err => errorHandler(err, response));
};

export const login = (request: Request, response: Response): void => {
	logger.log('Login');
	response.status(200).send(request.user);
};

export const changePassword = (request: Request, response: Response): void => {
	logger.log('Changepassword');
	if (!request.body?.password) {
		return errorHandler('Empty password!', response);
	}

	const user: User = User.getDefaultUser(request.user);
	bcrypt.hash(request.body.password, 10)
		.then(salt => {
			user.password = salt;
			const sqlChangePassword = 'UPDATE users SET password = ? WHERE username = ?';
			return databaseQuerry(sqlChangePassword, [salt, request.user?.username]);
		})
		.then(() => updateCachedUser(request.user?.username, user))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Changepassword success!'))
		.catch(err => errorHandler(err, response));
};

export const changeUsername = (request: Request, response: Response): void => {
	logger.log('Changeusername');
	if (!request.body?.username) {
		return errorHandler('Empty username!', response);
	}

	const sqlChangeUsername = 'UPDATE users SET username = ? WHERE username = ?';
	databaseQuerry(sqlChangeUsername, [request.body.username, request.user?.username])
		.then(() => updateCachedUser(request.user?.username, User.getDefaultUser({ ...request.user, username: request.body.username })))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Changeusername success!'))
		.catch(err => errorHandler(err, response));
};

export const logout = (request: Request, response: Response): void => {
	logger.log('Logout', request.user?.username);
	deleteCachedUser(request.user?.username);
	response.sendStatus(200);
};

export const deleteUser = (request: Request, response: Response): void => {
	logger.log('Delete User');

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

export const getUserFromDB = async (username: string): Promise<User> => {
	const sql = 'SELECT * FROM users WHERE username like ?';
	const data: User[] = await databaseQuerry(sql, username);
	return data[0];
};
