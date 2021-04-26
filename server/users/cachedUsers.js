const util = require('../util');
const { getAllowedUserProperties } = require('./users');

const functions = {};

const cachedUsers = [];

functions.addCachedUser = (user) => {
	if (!user) {
		throw new Error('addCachedUser - no user');
	}
	functions.resetCacheTimeOf(user);
	cachedUsers.push(user);
};

functions.deleteCachedUser = (username) => {
	if (!username) {
		throw new Error('deleteCachedUser - no user');
	}
	const index = cachedUsers.findIndex(u => u.username === username);
	if (index === -1) {
		throw new Error('No user found for' + username);
	}
	cachedUsers.splice(index, 1);
};

functions.updateCachedUser = (oldUsername, newUserData) => {
	if (!oldUsername || !newUserData) {
		throw new Error(`updateCachedUser - missing input - ${oldUsername}, ${newUserData}`);
	}
	const user = cachedUsers.find(user => user.username === oldUsername);

	for (const key in util.deleteNotAllowedProperties(getAllowedUserProperties(), newUserData)) {
		user[key] = newUserData[key];
	}

	functions.resetCacheTimeOf(user);
};

functions.resetCacheTimeOf = (user) => {
	if (!user) {
		throw new Error('resetCacheTimeOf - no user - ' + user);
	}
	user.cachedTime = Date.now();
};

functions.getCachedUsers = () => cachedUsers;

setInterval(() => {
	const currentTime = Date.now();
	cachedUsers
		.filter(user => currentTime - user.cachedTime > 300000) //5mins
		.forEach(user => functions.deleteCachedUser(user.username));
}, 150000);

module.exports = functions;