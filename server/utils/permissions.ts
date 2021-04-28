import { Request, Response, NextFunction } from 'express';
import { Permission, PermissionDetails, PermissionNamesType, PermissionsMap } from '../models/permission';
import Logger from './logger';
import { errorHandler } from './util';

const logger = new Logger('Permissions');

export const hasPerms = (...perms: PermissionNamesType[]): (request: Request, response: Response, next: NextFunction) => void => {
	return (request: Request, response: Response, next: NextFunction) => {
		logger.log('Check that', request.user?.username, 'has', perms);

		if (request.user?.permissions && !containsAllPerms(request.user.permissions, perms)) {
			return errorHandler('No permissions for this action!', response, 403);
		}
		logger.log('Permcheck success');
		next();
	};
};

const containsAllPerms = (userPerm: Permission, mustHave: PermissionNamesType[]) => {
	const permsToCheck: number[] = [];
	if (userPerm.permissions) {
		if (userPerm.permissions.indexOf(getPermissionDetailsOfType('ADMIN').id) !== -1) {
			return true;
		}
		permsToCheck.push(...userPerm.permissions);
	}
	if (userPerm.hasDefault) {
		permsToCheck.push(...getDefaultPermissionDetails().map(permDetail => permDetail.id));
	}
	if (permsToCheck.length === 0) {
		return false;
	}

	for (const needed of getPermissionDetailsOfTypes(mustHave).map(permDetail => permDetail.id)) {
		if (permsToCheck.indexOf(needed) === -1) {
			return false;
		}
	}

	return true;
};

const getDefaultPermissionDetails = () => {
	return getAllPermissionDetails().filter(permDetail => permDetail.isDefault);
};

const getAllPermissionDetails = () => {
	const perms: PermissionDetails[] = [];
	for (const name in PermissionsMap) {
		perms.push(PermissionsMap[name as PermissionNamesType]);
	}
	return perms;
};

const getPermissionDetailsOfTypes = (type: PermissionNamesType[]) => {
	return type.map(t => PermissionsMap[t]);
};

const getPermissionDetailsOfType = (type: PermissionNamesType) => {
	return PermissionsMap[type];
};