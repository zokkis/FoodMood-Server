import { Request, Response, NextFunction, request } from 'express';
import { User, LightUser } from '../models/user';
import { getUserFromDB } from '../utils/database';
import { getCachedUsers, addCachedUser, setNewCacheTime } from './cachedUser';
import Logger from './logger';
import { errorHandler } from './util';
import bcrypt from 'bcrypt';

const logger = new Logger('Auth');

export const checkAuth = (request: Request, response: Response, next: NextFunction): void => {
	logger.log(`${request.ip} try to connect!`);
	if (['/', '/info', '/register'].includes(request.url)) {
		return next();
	}

	logger.log('Check Auth of', request.headers.authorization);
	if (!request.headers.authorization) {
		return errorHandler(`Authentication required for ${request.url}!`, response, 400);
	}

	const b64auth = request.headers.authorization.split(' ')[1];
	// eslint-disable-next-line
	const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':');
	if (!username || !password) {
		return errorHandler('Username or password is missing!', response, 400);
	}

	checkAuthOf(username, password, response, next);
};

const checkAuthOf = async (username: string, password: string, response: Response, next: NextFunction) => {
	let user: User;

	try {
		user = getCachedUsers().find(user => user.username === username) || await getUserFromDB(username);
		if (!user) {
			return errorHandler('Username or password is wrong!', response);
		}
	} catch (err) {
		return errorHandler(err, response);
	}

	bcrypt.compare(password, user.password)
		.then(isSame => {
			if (!isSame) {
				throw new Error('Username or password is wrong!');
			}
			const isNew = !user.cachedTime;
			isNew ? addCachedUser(User.getDefaultUser(user)) : setNewCacheTime(user);
			logger.log(isNew ? 'Auth success' : 'Cached auth success');
			request.user = LightUser.fromUser(user);
			next();
		})
		.catch(err => errorHandler(err, response));
};
