import { tryParse } from '../utils/parser';
import { Permission } from './permission';
import { ShoppingList } from './shoppingList';

interface IDBInsertUser {
	username: string;
	password: string;
	permissions: string;
	favorites: string;
	shoppingList: string;
}

interface ILightUser {
	userId: number;
	username: string;
	permissions: Permission;
	favorites: number[];
	shoppingList: ShoppingList[];
}

interface IUser extends ILightUser {
	password: string;
	lastEdit?: string;
	cachedTime?: number;
}

export class User implements IUser {
	constructor(
		public userId: number,
		public username: string,
		public password: string,
		public permissions: Permission = { hasDefault: true },
		public favorites: number[] = [],
		public shoppingList: ShoppingList[] = [],
		public lastEdit?: string,
		public cachedTime?: number
	) {}

	static getDefaultUser(user?: User): User {
		return new User(
			user?.userId || -1,
			user?.username || '',
			user?.password || '',
			tryParse<Permission>(user?.permissions) || user?.permissions,
			tryParse<number[]>(user?.favorites) || user?.favorites,
			tryParse<ShoppingList[]>(user?.shoppingList) || user?.shoppingList,
			user?.lastEdit,
			user?.cachedTime
		);
	}
}

export class LightUser implements ILightUser {
	constructor(
		public userId: number,
		public username: string,
		public permissions: Permission = { hasDefault: true },
		public favorites: number[] = [],
		public shoppingList: ShoppingList[] = [],
		public lastEdit?: string
	) {}

	static fromUser(user: User | IUser): LightUser {
		return new LightUser(
			user.userId,
			user.username,
			tryParse<Permission>(user.permissions) || user.permissions,
			tryParse<number[]>(user.favorites) || user.favorites,
			tryParse<ShoppingList[]>(user.shoppingList) || user.shoppingList
		);
	}

	static getDBInsertUser(user: { username: string; password: string }): IDBInsertUser {
		return {
			username: user.username,
			password: user.password,
			permissions: '{"hasDefault": true}',
			favorites: '[]',
			shoppingList: '[]',
		};
	}
}
