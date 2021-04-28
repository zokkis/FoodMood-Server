export interface Permission {
	hasDefault: boolean;
	permissions?: number[];
}

export interface PermissionDetails {
	id: number;
	value?: number;
	isDefault?: boolean;
}

export type PermissionNamesType = 'VIEW_FOOD' | 'ADD_FOOD' | 'CHANGE_FOOD' | 'DELETE_FOOD' | 'EDIT_PASSWORD' | 'EDIT_USERNAME' | 'VIEW_USERS' | 'VIEW_USERS_FAVORITES' | 'SEND_MESSAGES' | 'EDIT_MESSAGES' | 'DELETE_MESSAGES' | 'CREATE_CATEGORY' | 'EDIT_CATEGORY' | 'DELETE_CATEGORY_LAST_CHILD' | 'DELETE_CATEGORY_WITH_CHILD' | 'DELETE_CATEGORY_MAIN' | 'VIEW_IMAGES' | 'VIEW_VIDEOS' | 'DELETE_IMAGES' | 'DELETE_VIDEOS' | 'ADD_IMAGES' | 'ADD_VIDEOS' | 'ADMIN';

//export const PermissionNames = ['VIEW_FOOD', 'ADD_FOOD', 'CHANGE_FOOD', 'DELETE_FOOD', 'EDIT_PASSWORD', 'EDIT_USERNAME', 'VIEW_USERS', 'VIEW_USERS_FAVORITES', 'SEND_MESSAGES', 'EDIT_MESSAGES', 'DELETE_MESSAGES', 'CREATE_CATEGORY', 'EDIT_CATEGORY', 'DELETE_CATEGORY_LAST_CHILD', 'DELETE_CATEGORY_WITH_CHILD', 'DELETE_CATEGORY_MAIN', 'VIEW_IMAGES', 'VIEW_VIDEOS', 'DELETE_IMAGES', 'DELETE_VIDEOS', 'ADD_IMAGES', 'ADD_VIDEOS', 'ADMIN'] as const;

//export type PermissionNamesType = typeof PermissionNames[number];

type Permissions = { [name in PermissionNamesType]: PermissionDetails };

export const PermissionsMap: Permissions = {
	VIEW_FOOD: {
		id: 100,
		isDefault: true
	},
	ADD_FOOD: {
		id: 200,
		isDefault: true
	},
	CHANGE_FOOD: {
		id: 300
	},
	DELETE_FOOD: {
		id: 400
	},
	EDIT_PASSWORD: {
		id: 500,
		isDefault: true
	},
	EDIT_USERNAME: {
		id: 600,
		isDefault: true
	},
	VIEW_USERS: {
		id: 700,
		isDefault: true
	},
	VIEW_USERS_FAVORITES: {
		id: 800
	},
	SEND_MESSAGES: {
		id: 900
	},
	EDIT_MESSAGES: {
		id: 1000
	},
	DELETE_MESSAGES: {
		id: 1100
	},
	CREATE_CATEGORY: {
		id: 1200
	},
	EDIT_CATEGORY: {
		id: 1300
	},
	DELETE_CATEGORY_LAST_CHILD: {
		id: 1400
	},
	DELETE_CATEGORY_WITH_CHILD: {
		id: 1500
	},
	DELETE_CATEGORY_MAIN: {
		id: 1600
	},
	VIEW_IMAGES: {
		id: 1700,
		isDefault: true
	},
	VIEW_VIDEOS: {
		id: 1800,
		isDefault: true
	},
	DELETE_IMAGES: {
		id: 1900
	},
	DELETE_VIDEOS: {
		id: 2000
	},
	ADD_IMAGES: {
		id: 15000,
		value: 15,
		isDefault: true
	},
	ADD_VIDEOS: {
		id: 15100,
		value: 1
	},
	ADMIN: {
		id: 900001
	}
};