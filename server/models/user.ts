import { Permission } from './permission';
import { ShoppingList } from './shoppingList';

export interface ILightUser {
	userId: number;
	username: string;
	permissions: Permission;
	favorites?: number[];
	shoppingList?: ShoppingList;
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
		public permissions: Permission,
		public favorites?: number[],
		public shoppingList?: ShoppingList,
		public lastEdit?: string,
		public cachedTime?: number) {
	}

	// eslint-disable-next-line
	public static getDefaultUser(user?: any): User {
		return new User(
			user?.userId || -1,
			user?.username || '',
			user?.password || '',
			typeof user?.permissions === 'string' ? JSON.parse(user.permissions) : user?.permissions || { hasDefault: true },
			typeof user?.favorites === 'string' ? JSON.parse(user.favorites) : user?.favorites,
			typeof user?.shoppingList === 'string' ? JSON.parse(user.shoppingList) : user?.shoppingList,
			user?.lastEdit,
			user?.cachedTime
		);
	}
}

export class LightUser implements ILightUser {
	constructor(
		public userId: number,
		public username: string,
		public permissions: Permission,
		public favorites?: number[],
		public shoppingList?: ShoppingList) {
	}

	public static fromUser(user: User | IUser): LightUser {
		return new LightUser(
			user.userId,
			user.username,
			user.permissions,
			user.favorites,
			user.shoppingList
		);
	}
}