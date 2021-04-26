const bcrypt = require('bcrypt');
const { databaseQuerry } = require('../database');
const { prepareUserToSend, getAllowedUserProperties } = require('./users');
const { addCachedUser, resetCacheTimeOf, getCachedUsers, deleteCachedUser, updateCachedUser } = require('./cachedUsers');
const util = require('../util');
const Logger = require('../logger');

const logger = new Logger('Express-User');

const functions = {};

functions.register = function (request, response) {
	logger.log('Register');
	if (!request.body?.username || !request.body.password) {
		return util.errorHandler('Missing username or password!', response);
	}

	bcrypt.hash(request.body.password, 10)
		.then(salt => {
			util.deleteNotAllowedProperties(getAllowedUserProperties(), request.body);

			const sqlRegisterUser = 'INSERT INTO users SET ?';
			return databaseQuerry(sqlRegisterUser, { ...request.body, permissions: JSON.stringify({ isDefault: true }), password: salt });
		})
		.then(user => response.status(200).send({ userId: user.insertId }))
		.then(() => logger.log('Register success!'))
		.catch(err => util.errorHandler(err, response));
};

functions.changePassword = function (request, response) {
	logger.log('Changepassword');
	if (!request.body?.password) {
		return util.errorHandler('Empty password!', response);
	}

	let password;
	bcrypt.hash(request.body.password, 10)
		.then(salt => {
			password = salt;
			const sqlChangePassword = 'UPDATE users SET password = ? WHERE username = ?';
			return databaseQuerry(sqlChangePassword, [salt, request.user.username]);
		})
		.then(() => updateCachedUser(request.user.username, { password }))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Changepassword success!'))
		.catch(err => util.errorHandler(err, response));
};

functions.changeUsername = function (request, response) {
	logger.log('Changeusername');
	if (!request.body?.username) {
		return util.errorHandler('Empty username!', response);
	}

	const sqlChangeUsername = 'UPDATE users SET username = ? WHERE username = ?';
	databaseQuerry(sqlChangeUsername, [request.body.username, request.user.username])
		.then(() => updateCachedUser(request.user.username, { username: request.body.username }))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Changeusername success!'))
		.catch(err => util.errorHandler(err, response));
};

functions.logout = function (request, response) {
	logger.log('Logout', request.user.username);
	deleteCachedUser(request.user.username);
	response.sendStatus(200);
};

functions.deleteUser = function (request, response) {
	logger.log('Delete User');
	const sqlDeleteUser = 'DELETE FROM users WHERE username = ?';
	databaseQuerry(sqlDeleteUser, request.user.username)
		.then(serverStatus => {
			if (serverStatus.affectedRows < 1) {
				throw new Error('User not deleted!');
			}
			deleteCachedUser(request.user.username);
		})
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Delete success!'))
		.catch(err => util.errorHandler(err, response));
};

functions.checkAuth = function checkAuth(request, response, next) {
	logger.log(`${request.ip} try to connect!`);
	if (['/', '/info', '/register'].includes(request.url)) {
		return next();
	}

	logger.log('Check Auth of', request.headers.authorization);
	if (!request.headers.authorization) {
		return util.errorHandler(`Authentication required for ${request.url}!`, response, 400);
	}

	const b64auth = request.headers.authorization.split(' ')[1];
	// eslint-disable-next-line
	const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':');
	if (!username || !password) {
		return util.errorHandler('Username or password is missing!', response, 400);
	}

	checkAuthOf(username, password, request, response, next);
};

const checkAuthOf = async (username, password, request, response, next) => {
	let user = getCachedUsers().find(user => user.username === username);
	const isCached = !user;
	if (isCached) {
		const sql = 'SELECT * FROM users WHERE username like ?';
		const data = await databaseQuerry(sql, username)
			.catch(err => util.errorHandler(err, response));
		if (data.length !== 1) {
			return util.errorHandler('Username or password is wrong!', response, 401);
		}
		user = data[0];
	}

	bcrypt.compare(password, user.password)
		.then(isSame => {
			if (!isSame) {
				throw new Error('Username or password is wrong!');
			}
			isCached ? addCachedUser(user) : resetCacheTimeOf(user);
			request.user = prepareUserToSend(user);
			logger.log(isCached ? 'Auth success' : 'Cached auth success', request.user);
			next();
		})
		.catch(err => util.errorHandler(err, response));
};

module.exports = functions;