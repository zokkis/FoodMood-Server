import { NextFunction, Request, Response } from 'express';
import { Permission, PermissionDetails, PermissionNamesType, PermissionsMap } from '../models/permission';
import { errorHandler } from './error';
import Logger from './logger';

const logger = new Logger('Permissions');

export const hasPerms = (...perms: PermissionNamesType[]): (request: Request, response: Response, next: NextFunction) => void => {
	return (request: Request, response: Response, next: NextFunction): void => {
		logger.log('Check that', request.user.username, 'has', perms);

		if (request.user.permissions && !containsAllPerms(request.user.permissions, perms)) {
			return errorHandler(response, 403);
		}
		logger.log('Permcheck success');
		next();
	};
};

const containsAllPerms = (userPerm: Permission, mustHave: PermissionNamesType[]): boolean => {
	const permsToCheck: number[] = getPermissionIdsToCheck(userPerm);

	if (permsToCheck.length === 0) {
		return false;
	}
	if (permsToCheck.indexOf(getPermissionDetailsOfType('ADMIN').id) !== -1) {
		return true;
	}

	for (const needed of getPermissionDetailsOfTypes(mustHave).map(permDetail => permDetail.id)) {
		if (permsToCheck.indexOf(needed) === -1) {
			return false;
		}
	}

	return true;
};

const getDefaultPermissionDetails = (): PermissionDetails[] => {
	return getAllPermissionDetails().filter(permDetail => permDetail.isDefault);
};

const getAllPermissionDetails = (): PermissionDetails[] => {
	const perms: PermissionDetails[] = [];
	for (const name in PermissionsMap) {
		perms.push(getPermissionDetailsOfType(name as PermissionNamesType));
	}
	return perms;
};

const getPermissionDetailsOfTypes = (type: PermissionNamesType[]): PermissionDetails[] => {
	return type.map(t => getPermissionDetailsOfType(t));
};

export const getPermissionDetailsOfType = (type: PermissionNamesType): PermissionDetails => {
	return PermissionsMap[type];
};

export const getPermissionIdsToCheck = (permission: Permission): number[] => {
	const permsToCheck: number[] = [];
	if (permission?.permissions) {
		permsToCheck.push(...permission.permissions);
	}
	if (permission?.hasDefault) {
		permsToCheck.push(...getDefaultPermissionDetails().map(permDetail => permDetail.id));
	}
	return permsToCheck;
};