import { NextFunction, Request, Response } from 'express';
import { LightUser } from '../models/user';
import { getUserByUsername } from '../utils/database';
import { addCachedUser, setNewCacheTime } from './cachedUser';
import { compare } from './crypto';
import { errorHandler, RequestError } from './error';
import Logger from './logger';

const logger = new Logger('Auth');

export const checkAuth = (request: Request, response: Response, next: NextFunction): void => {
	logger.log(request.ip + ' try to connect!');
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
	return getUserByUsername(username).then(dbUser => {
		if (!compare(password, dbUser.password)) {
			throw new RequestError(401);
		}

		const isNew = !dbUser.cachedTime;
		isNew ? addCachedUser(dbUser) : setNewCacheTime(dbUser);
		logger.log(isNew ? 'Auth success' : 'Cached auth success');
		return LightUser.fromUser(dbUser);
	});
};
