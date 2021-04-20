const Logger = require('./logger');
const _ = require('lodash');

const logger = new Logger('Users');

const functions = {};

const cachedUsers = [];

functions.addCachedUser = (user) => {
	if (!user) {
		return logger.error('addCachedUser - no user', user);
	}
	functions.resetCacheTimeOf(user);
	cachedUsers.push(user);
};

functions.deleteCachedUser = (username) => {
	if (!username) {
		return logger.error('deleteCachedUser - no user', username);
	}
	const index = cachedUsers.findIndex(u => u.username === username);
	if (index === -1) {
		return logger.error('No user found for', username);
	}
	cachedUsers.splice(index, 1);
};

functions.updateCachedUser = (oldUsername, newUserData) => {
	if (!oldUsername || !newUserData) {
		return logger.error('updateCachedUser - missing input', oldUsername, newUserData);
	}
	const user = cachedUsers.find(user => user.username === oldUsername);

	for (const key in newUserData) {
		if (!functions.getAllowedProperties().includes(key)) {
			logger.warn('Too much data -', key);
			continue;
		}
		user[key] = newUserData[key];
	}
	functions.resetCacheTimeOf(user);
};

functions.resetCacheTimeOf = (user) => {
	if (!user) {
		return logger.error('resetCacheTimeOf - no user', user);
	}
	user.cachedTime = Date.now();
};

functions.getCachedUsers = () => cachedUsers;

functions.prepareUserToSend = (user) => {
	if (!user) {
		return logger.error('prepareUserToSend - no user', user);
	}
	user = _.merge({}, user, { permissions: user.permissions });
	delete user.password;
	delete user.cachedTime;
	return user;
};

functions.getAllowedProperties = () => ['username', 'password', 'permissions', 'favorites', 'shoppingList'];

setInterval(() => {
	const currentTime = Date.now();
	cachedUsers
		.filter(user => currentTime - user.cachedTime > 300000) //5mins
		.forEach(user => functions.deleteCachedUser(user.username));
}, 150000);

module.exports = functions;