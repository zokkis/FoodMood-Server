functions = {};

const cachedUsers = [];

functions.addCachedUser = (user) => {
	updateCachedUser(user);
	cachedUsers.push(user);
}

functions.updateCachedUser = (user) => {
	user.cachedTime = Date.now();
}

functions.getCachedUsers = () => cachedUsers;

functions.prepareUserToSend = (user) => {
	user.permissions = JSON.parse(user.permissions);
	delete user.password;
	delete user.cachedTime;
	return user;
}

setInterval(() => {
	const currentTime = Date.now();
	cachedUsers = cachedUsers.filter(user => currentTime - user.cachedTime < 300000); //5mins
}, 150000);

module.exports = functions;