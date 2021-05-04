import { tryParse } from '../utils/validator';
import { Permission } from './permission';
import { ShoppingList } from './shoppingList';

export interface IDBInsertUser {
	username: string;
	password: string;
	permissions: string;
	favorites: string;
	shoppingList: string;
}

export interface ILightUser {
	userId: number;
	username: string;
	permissions: Permission;
	favorites: number[];
	shoppingList: ShoppingList[];
}

export interface IUser extends ILightUser {
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
		public cachedTime?: number) {
	}

	public static getDefaultUser(user?: User): User {
		return new User(
			user?.userId || -1,
			user?.username || '',
			user?.password || '',
			tryParse(user?.permissions) || user?.permissions,
			tryParse(user?.favorites) || user?.favorites,
			tryParse(user?.shoppingList) || user?.shoppingList,
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
		public shoppingList: ShoppingList[] = []) {
	}

	public static fromUser(user: User | IUser): LightUser {
		return new LightUser(
			user.userId,
			user.username,
			tryParse(user.permissions) || user.permissions,
			tryParse(user.favorites) || user.favorites,
			tryParse(user.shoppingList) || user.shoppingList
		);
	}

	public static getDBInsertUser(user: User | IUser): IDBInsertUser {
		return {
			username: user.username,
			password: user.password,
			permissions: '{"hasDefault": true}',
			favorites: '[]',
			shoppingList: '[]'
		};
	}
}