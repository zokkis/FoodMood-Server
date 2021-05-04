import { Request, Response } from 'express';
import { OkPacket } from 'mysql';
import { Category } from '../models/category';
import { databaseQuerry, getEntitiesWithId, isValideSQLTimestamp } from '../utils/database';
import Logger from '../utils/logger';
import { getPermissionDetailsOfType, getPermissionIdsToCheck } from '../utils/permissions';
import { errorHandler, RequestError } from '../utils/error';
import { defaultHttpResponseMessages } from '../models/httpResponse';
import { isPositiveSaveInteger } from '../utils/validator';

const logger = new Logger('Category');

export const addCategory = (request: Request, response: Response): void => {
	if (!request.body) {
		return errorHandler(response, 400);
	}

	const sqlToAdd = 'INSERT INTO categories SET ?';
	databaseQuerry(sqlToAdd, { ...Category.getFromJson(request.body), categoryId: undefined })
		.then(() => response.status(201).send(defaultHttpResponseMessages.get(201)))
		.then(() => logger.log('Addcategory success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const deleteCategory = async (request: Request, response: Response): Promise<void> => {
	const categoryId = Number(request.body.categoryId);
	if (!isPositiveSaveInteger(categoryId)) {
		return errorHandler(response, 400);
	}

	if ((await getEntitiesWithId(categoryId)).length !== 0) {
		return errorHandler(response, 400, 'Refactor this!');
	}

	const permsToCheck = getPermissionIdsToCheck(request.user.permissions);
	const canDeleteMain = permsToCheck.indexOf(getPermissionDetailsOfType('DELETE_CATEGORY_MAIN').id) !== -1;
	const canDeleteWith = permsToCheck.indexOf(getPermissionDetailsOfType('DELETE_CATEGORY_WITH_CHILD').id) !== -1;
	const canDeleteLast = permsToCheck.indexOf(getPermissionDetailsOfType('DELETE_CATEGORY_LAST_CHILD').id) !== -1;

	if (!canDeleteMain && !canDeleteLast && !canDeleteWith) {
		return errorHandler(response, 403);
	}

	let isMain = false;
	let parentId: number | undefined;

	const sqlDeleteCategory = 'SELECT parentCategoryId FROM categories WHERE categoryId = ?';
	databaseQuerry(sqlDeleteCategory, categoryId)
		.then((data: Category[]) => {
			if (data.length !== 1) {
				throw new RequestError(422);
			}
			parentId = data[0].parentCategoryId;

			if (!parentId || parentId === categoryId) {
				if (!canDeleteMain) {
					throw new RequestError(403);
				}
				isMain = true;
			}
			const sqlCheckHasChilds = 'SELECT categoryId FROM categories WHERE parentCategoryId = ?';
			return databaseQuerry(sqlCheckHasChilds, categoryId);
		})
		.then((childs: Category[]) => {
			if (childs.length > 0 && !canDeleteWith) {
				throw new RequestError(403);
			}
			const sqlChangeParentId = 'UPDATE categories SET parentCategoryId = ? WHERE parentCategoryId = ?';
			return databaseQuerry(sqlChangeParentId, [isMain ? null : parentId, categoryId]);
		})
		.then(() => {
			const sqlDeleteCategory = 'DELETE FROM categories WHERE categoryId = ?';
			return databaseQuerry(sqlDeleteCategory, categoryId);
		})
		.then(() => response.status(202).send(defaultHttpResponseMessages.get(202)))
		.then(() => logger.log('Changecategory success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const changeCategory = (request: Request, response: Response): void => {
	const categoryId = Number(request.body.categoryId);
	if (!isPositiveSaveInteger(categoryId) || (!request.body.title && !isPositiveSaveInteger(request.body.parentId))) {
		return errorHandler(response, 400);
	}

	let sqlChangeCategory = 'UPDATE categories SET ';
	const insetValues: string[] = [];

	if (request.body.title) {
		sqlChangeCategory += request.body.title + ' = ?, ';
		insetValues.push(request.body.title);
	}
	if (request.body.parentId) {
		sqlChangeCategory += request.body.parentId + ' = ?, ';
		insetValues.push(request.body.parentId);
	}

	sqlChangeCategory = sqlChangeCategory.substring(0, sqlChangeCategory.length - 2) + ' WHERE categoryId = ?';
	databaseQuerry(sqlChangeCategory, [...insetValues, categoryId])
		.then((data: OkPacket) => response.status(201).send(data))
		.then(() => logger.log('Changecategory success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const getCategories = (request: Request, response: Response): void => {
	const isValideQuery = isValideSQLTimestamp(request.query.lastEdit);

	let sqlGetCategories = 'SELECT * FROM categories';
	sqlGetCategories += isValideQuery ? ' WHERE lastEdit >= ?' : '';
	databaseQuerry(sqlGetCategories, isValideQuery ? request.body.lastEdit : undefined)
		.then((categories: Category[]) => {
			for (const cat of categories) {
				delete cat.lastEdit;
			}
			response.status(200).send(categories);
		})
		.then(() => logger.log('Getcategory success!'))
		.catch(err => errorHandler(response, 500, err));
};