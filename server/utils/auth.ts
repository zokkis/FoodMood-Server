import bcrypt from 'bcrypt';
import { NextFunction, Request, Response } from 'express';
import { LightUser, User } from '../models/user';
import { getUserByUsername } from '../utils/database';
import { addCachedUser, setNewCacheTime } from './cachedUser';
import { errorHandler, RequestError } from './error';
import Logger from './logger';

const logger = new Logger('Auth');

export const checkAuth = (request: Request, response: Response, next: NextFunction): void => {
	logger.log(`${request.ip} try to connect!`);
	if (!request.headers.authorization) {
		return errorHandler(response, 401);
	}

	const b64auth = request.headers.authorization.split(' ')[1];
	const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':');
	if (!username || !password) {
		return errorHandler(response, 401);
	}

	checkAuthOf(username, password)
		.then(user => {
			request.user = user;
			next();
		})
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

const checkAuthOf = (username: string, password: string): Promise<LightUser> => {
	let user: User;

	return getUserByUsername(username, false)
		.then(dbUser => {
			user = dbUser;
			return bcrypt.compare(password, user.password);
		})
		.then(isSame => {
			if (!isSame) {
				throw new RequestError(401);
			}
			const isNew = !user.cachedTime;
			isNew ? addCachedUser(user) : setNewCacheTime(user);
			logger.log(isNew ? 'Auth success' : 'Cached auth success');
			return LightUser.fromUser(user);
		});
};