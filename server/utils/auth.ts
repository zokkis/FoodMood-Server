import { Request, Response, NextFunction, request } from 'express';
import { User, LightUser } from '../models/user';
import { getUserByUsername } from '../utils/database';
import { addCachedUser, setNewCacheTime } from './cachedUser';
import Logger from './logger';
import { errorHandler, RequestError } from './error';
import bcrypt from 'bcrypt';

const logger = new Logger('Auth');

export const checkAuth = (request: Request, response: Response, next: NextFunction): void => {
	logger.log(`${request.ip} try to connect with ${request.headers.authorization}!`);
	if (!request.headers.authorization) {
		return errorHandler(response, 401);
	}

	const b64auth = request.headers.authorization.split(' ')[1];
	const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':');
	if (!username || !password) {
		return errorHandler(response, 401);
	}

	checkAuthOf(username, password, response, next);
};

const checkAuthOf = async (username: string, password: string, response: Response, next: NextFunction) => {
	let user: User;

	getUserByUsername(username)
		.then((dbUser: User) => {
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
			request.user = LightUser.fromUser(user);
			next();
		})
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};
