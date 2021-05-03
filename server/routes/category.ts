import { Request, Response } from 'express';
import { OkPacket } from 'mysql';
import { Category } from '../models/category';
import { databaseQuerry, getEntitiesWithId, isValideSQLTimestamp } from '../utils/database';
import Logger from '../utils/logger';
import { getPermissionDetailsOfType, getPermissionIdsToCheck } from '../utils/permissions';
import { errorHandler } from '../utils/util';

const logger = new Logger('Category');

export const addCategory = (request: Request, response: Response): void => {
	if (!request.body) {
		return errorHandler('No category to add!', response);
	}

	const sqlToAdd = 'INSERT INTO categories SET ?';
	databaseQuerry(sqlToAdd, Category.getFromJson(request.body))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Addcategory success'))
		.catch(err => errorHandler(err, response));
};

export const deleteCategory = async (request: Request, response: Response): Promise<void> => {
	const categoryId = request.body?.categoryId;
	if (!categoryId) {
		return errorHandler('No id to delete!', response);
	}

	if ((await getEntitiesWithId(categoryId)).length !== 0) {
		return errorHandler('There is a food with this id! -> refactor this!', response);
	}

	const permsToCheck = getPermissionIdsToCheck(request.user?.permissions);
	const canDeleteMain = permsToCheck.indexOf(getPermissionDetailsOfType('DELETE_CATEGORY_MAIN').id) !== -1;
	const canDeleteWith = permsToCheck.indexOf(getPermissionDetailsOfType('DELETE_CATEGORY_WITH_CHILD').id) !== -1;
	const canDeleteLast = permsToCheck.indexOf(getPermissionDetailsOfType('DELETE_CATEGORY_LAST_CHILD').id) !== -1;

	if (!canDeleteMain && !canDeleteLast && !canDeleteWith) {
		return errorHandler('No permissions to delete!', response);
	}

	let isMain = false;
	let parentId: number | undefined;

	const sqlDeleteCategory = 'SELECT parentCategoryId FROM categories WHERE categoryId = ?';
	databaseQuerry(sqlDeleteCategory, categoryId)
		.then((data: Category[]) => {
			if (data.length !== 1) {
				throw new Error(data.length === 0 ? 'No category for this id!' : 'Internal error with this id!');
			}
			parentId = data[0].parentCategoryId;

			if (parentId === null || parentId === categoryId) {
				if (!canDeleteMain) {
					throw new Error('No permissions to delete main-category!');
				}
				isMain = true;
			}
			const sqlCheckHasChilds = 'SELECT categoryId FROM categories WHERE parentCategoryId = ?';
			return databaseQuerry(sqlCheckHasChilds, categoryId);
		})
		.then((childs: Category[]) => {
			if (childs.length > 0 && !canDeleteWith) {
				throw new Error('No permissions to delete category with childs!');
			}
			const sqlChangeParentId = 'UPDATE categories SET parentCategoryId = ? WHERE parentCategoryId = ?';
			return databaseQuerry(sqlChangeParentId, [isMain ? null : parentId, categoryId]);
		})
		.then(() => {
			const sqlDeleteCategory = 'DELETE FROM categories WHERE categoryId = ?';
			return databaseQuerry(sqlDeleteCategory, categoryId);
		})
		.catch(err => errorHandler(err, response));
};

export const changeCategory = (request: Request, response: Response): void => {
	const categoryId = request.body?.categoryId;
	if (!categoryId) {
		return errorHandler('No id to change!', response);
	} else if (!request.body?.title && !request.body?.parentId) {
		return errorHandler('No new value!', response);
	}

	let sqlChangeCategory = 'UPDATE categories SET ';
	const insetValues: string[] = [];

	if (request.body?.title) {
		sqlChangeCategory += request.body.title + ' = ?, ';
		insetValues.push(request.body.title);
	}
	if (request.body?.parentId) {
		sqlChangeCategory += request.body.parentId + ' = ?, ';
		insetValues.push(request.body.parentId);
	}

	sqlChangeCategory = sqlChangeCategory.substring(0, sqlChangeCategory.length - 2) + ' WHERE categoryId = ?';
	databaseQuerry(sqlChangeCategory, [...insetValues, categoryId])
		.then((data: OkPacket) => response.status(200).send(data))
		.then(() => logger.log('Changecategory success!'))
		.catch(err => errorHandler(err, response));
};

export const getCategories = (request: Request, response: Response): void => {
	let sqlGetCategories = 'SELECT * FROM categories';
	sqlGetCategories += isValideSQLTimestamp(request.query.lastEdit as string) ? ' WHERE lastEdit >= ?' : '';
	databaseQuerry(sqlGetCategories, request.body.lastEdit)
		.then((categories: Category[]) => {
			for (const cat of categories) {
				delete cat.lastEdit;
			}
			response.status(200).send(categories);
		})
		.catch(err => errorHandler(err, response));
};