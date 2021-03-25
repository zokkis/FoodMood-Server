const Logger = require('./logger');
const _ = require('lodash');

const logger = new Logger('Users');

functions = {};

const cachedUsers = [];

functions.addCachedUser = (user) => {
	if (!user) {
		return logger.error('addCachedUser - no user', user);
	}
	functions.updateCachedUser(user);
	cachedUsers.push(user);
}

functions.deleteCachedUser = (username) => {
	if (!username) {
		return logger.error('deleteCachedUser - no user', username);
	}
	const index = cachedUsers.findIndex(u => u.username === username);
	if (index === -1) {
		return logger.error('No user found for', username);
	}
	cachedUsers.splice(index, 1);
}

functions.updateCachedUser = (user) => {
	if (!user) {
		return logger.error('updateCachedUser - no user', user);
	}
	user.cachedTime = Date.now();
}

functions.getCachedUsers = () => cachedUsers;

functions.prepareUserToSend = (user) => {
	if (!user) {
		return logger.error('prepareUserToSend - no user', user);
	}
	user = _.merge({}, user, {permissions: JSON.parse(user.permissions)});
	delete user.password;
	delete user.cachedTime;
	return user;
}

setInterval(() => {
	const currentTime = Date.now();
	cachedUsers
		.filter(user => currentTime - user.cachedTime < 300000) //5mins
		.forEach(user => functions.deleteCachedUser(user.username));
}, 150000);

module.exports = functions;