const functions = {};

functions.prepareUserToSend = (user) => {
	if (!user) {
		throw new Error('No user to prepare!');
	}
	user = { ...user, permissions: user.permissions };
	delete user.password;
	delete user.cachedTime;
	return user;
};

functions.getAllowedUserProperties = () => ['username', 'password', 'permissions', 'favorites', 'shoppingList'];

module.exports = functions;