import { Permission } from '../models/permission';
import { ShoppingList } from '../models/shoppingList';
import { User } from '../models/user';

const cachedUsers: User[] = [];

export const addCachedUser = (user: User): void => {
	if (!user) {
		throw new Error('addCachedUser - no user');
	}
	setNewCacheTime(user);
	cachedUsers.push(user);
};

export const deleteCachedUser = (username: string | undefined): void => {
	if (!username) {
		throw new Error('deleteCachedUser - no user');
	}
	const index = cachedUsers.findIndex(u => u.username === username);
	if (index === -1) {
		throw new Error('No user found for' + username);
	}
	cachedUsers.splice(index, 1);
};

export const updateCachedUser = (oldUsername: string | undefined, newUser: User): void => {
	if (!oldUsername || !newUser) {
		throw new Error(`updateCachedUser - missing input - ${oldUsername}, ${newUser}`);
	}

	deleteCachedUser(oldUsername);
	addCachedUser(newUser);
};

export const updateCachedUsersPropety = (username: string | undefined, prop: keyof User, newValue: number | string | number[] | Permission | ShoppingList[]): void => {
	if (!username || !prop || !newValue) {
		throw new Error(`updateCachedUser - missing input - ${username}, ${prop}, ${newValue}`);
	}

	const user = getCachedUserByName(username);
	// eslint-disable-next-line
	(user as any)[prop] = newValue;
	updateCachedUser(username, user as User);
};

export const setNewCacheTime = (user: User): void => {
	if (!user) {
		throw new Error('resetCacheTimeOf - no user - ' + user);
	}
	user.cachedTime = Date.now();
};

export const getCachedUsers = (): User[] => cachedUsers;

export const getCachedUserByName = (name: string | undefined): User | undefined => {
	return getCachedUsers().find(user => user.username === name);
};

setInterval(() => {
	const currentTime = Date.now();
	cachedUsers
		.filter(user => currentTime - (user.cachedTime || currentTime) > 300000) //5mins
		.forEach(user => deleteCachedUser(user.username));
}, 150000);