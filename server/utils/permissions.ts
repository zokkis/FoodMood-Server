import { NextFunction, Request, Response } from 'express';
import { Permission, PermissionDetails, PermissionNamesType, PERMISSIONS_MAP } from '../models/permission';
import { errorHandler } from './error';
import Logger from './logger';

const logger = new Logger('Permissions');

export const hasPerms = (...perms: PermissionNamesType[]): ((request: Request, response: Response, next: NextFunction) => void) => {
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
	if (userPerm.permissions?.includes(getPermissionDetailsOfType('ADMIN').id)) {
		return true;
	}

	const permsToCheck: number[] = getPermissionIdsToCheck(userPerm);
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

export const containsPermFromIds = (userPermIds: number[], mustHave: PermissionNamesType): boolean => {
	return (
		userPermIds.includes(getPermissionDetailsOfType('ADMIN').id) ||
		(userPermIds.length !== 0 && !(userPermIds.indexOf(getPermissionDetailsOfType(mustHave).id) === -1))
	);
};

const getDefaultPermissionDetails = (): PermissionDetails[] => {
	return getAllPermissionDetails().filter(permDetail => permDetail.isDefault);
};

const getAllPermissionDetails = (): PermissionDetails[] => {
	const perms: PermissionDetails[] = [];
	for (const name in PERMISSIONS_MAP) {
		perms.push(getPermissionDetailsOfType(name as PermissionNamesType));
	}
	return perms;
};

const getPermissionDetailsOfTypes = (type: PermissionNamesType[]): PermissionDetails[] => {
	return type.map(t => getPermissionDetailsOfType(t));
};

export const getPermissionDetailsOfType = (type: PermissionNamesType): PermissionDetails => {
	return PERMISSIONS_MAP[type];
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
