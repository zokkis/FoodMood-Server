import { Request, Response } from 'express';
import { OkPacket } from 'mysql';
import { Category, CATEGORY_PROPS } from '../models/category';
import { Food } from '../models/food';
import { defaultHttpResponseMessages } from '../models/httpResponse';
import { databaseQuerry, getCategoryById } from '../utils/database';
import { errorHandler, RequestError } from '../utils/error';
import Logger from '../utils/logger';
import { getSQLAndData } from '../utils/parser';
import { containsPermFromIds, getPermissionIdsToCheck } from '../utils/permissions';
import { isPositiveSafeInteger } from '../utils/validator';

const logger = new Logger('Category');

export const addCategory = (request: Request, response: Response): void => {
	if (!request.body || !request.body.title) {
		return errorHandler(response, 400);
	}

	const insertCategory = Category.getDBInsert(request.body);
	getCategoryById(insertCategory.parentId, !!insertCategory.parentId)
		.then(() => databaseQuerry<OkPacket>('INSERT INTO categories SET ?', insertCategory))
		.then(dbPacket => response.status(201).json({ ...insertCategory, categoryId: dbPacket.insertId }))
		.then(() => logger.log('Addcategory success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const deleteCategory = (request: Request, response: Response): Promise<void> | void => {
	const categoryId = Number(request.params.id);
	if (!isPositiveSafeInteger(categoryId)) {
		return errorHandler(response, 400);
	}

	return databaseQuerry<Food[]>('SELECT title FROM entity WHERE categoryId = ? ', categoryId)
		.then(foods => {
			const withEntities = !!foods.length;
			const permsToCheck = getPermissionIdsToCheck(request.user.permissions);
			const canChangeFood = containsPermFromIds(permsToCheck, 'CHANGE_FOOD');
			const canDeleteMain = containsPermFromIds(permsToCheck, 'DELETE_CATEGORY_MAIN');
			const canDeleteWith = containsPermFromIds(permsToCheck, 'DELETE_CATEGORY_WITH_CHILD');
			const canDeleteLast = containsPermFromIds(permsToCheck, 'DELETE_CATEGORY_LAST_CHILD');

			if ((withEntities && !canChangeFood) || (!canDeleteMain && !canDeleteLast && !canDeleteWith)) {
				throw new RequestError(403);
			}

			let parentId: number | undefined;
			return getCategoryById(categoryId)
				.then(category => {
					parentId = category.parentId;
					if ((!parentId || parentId === categoryId) && (!canDeleteMain || withEntities)) {
						// prettier-ignore
						throw new RequestError(403, withEntities ? 'Can\'t delete Main-Category with Entities!' : undefined);
					}
					const sqlCheckHasChilds = 'SELECT categoryId FROM categories WHERE parentId = ?';
					return databaseQuerry<Category[]>(sqlCheckHasChilds, categoryId);
				})
				.then(childs => {
					const hasChilds = !!childs.length;
					if (!canDeleteWith && hasChilds) {
						throw new RequestError(403);
					}
					if (!hasChilds) {
						return;
					}
					// no need to check for permissions -> already checked
					// set childs parentId to parentId or null
					const sqlChangeParentId = 'UPDATE categories SET parentId = ? WHERE parentId = ?';
					return databaseQuerry<OkPacket>(sqlChangeParentId, [parentId, categoryId]);
				})
				.then(() => {
					if (!withEntities) {
						return;
					}
					// parentId must be set - because can't be main
					// no need to check for main -> already checked
					// no need to check for permissions -> already checked
					const sqlChangeEntitiesCatId = 'UPDATE entity SET categoryId = ? WHERE categoryId = ?';
					return databaseQuerry<OkPacket>(sqlChangeEntitiesCatId, [parentId, categoryId]);
				});
		})
		.then(() => {
			const sqlDeleteCategory = 'DELETE FROM categories WHERE categoryId = ?';
			return databaseQuerry<OkPacket>(sqlDeleteCategory, categoryId);
		})
		.then(() => response.status(202).json(defaultHttpResponseMessages.get(202)))
		.then(() => logger.log('Changecategory success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const changeCategory = (request: Request, response: Response): void => {
	const categoryId = Number(request.params.id);
	if (!isPositiveSafeInteger(categoryId) || !request.body.title || !isPositiveSafeInteger(request.body.parentId)) {
		return errorHandler(response, 400);
	}

	const insertCategory = Category.getDBInsert(request.body);
	getCategoryById(categoryId)
		.then(() => {
			const sqlChangeCategory = 'UPDATE categories SET ? WHERE categoryId = ?';
			return databaseQuerry<OkPacket>(sqlChangeCategory, [insertCategory, categoryId]);
		})
		.then(() => response.status(201).json(insertCategory))
		.then(() => logger.log('Changecategory success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const getCategories = (request: Request, response: Response): void => {
	const { sql, queryData } = getSQLAndData(request.query, CATEGORY_PROPS);

	console.log('SELECT * FROM categories' + sql, queryData);
	databaseQuerry<Category[]>('SELECT * FROM categories' + sql, queryData)
		.then(categories => response.json(categories))
		.then(() => logger.log('Getcategory success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const getCategory = (request: Request, response: Response): void => {
	const categoryId = Number(request.params.id);
	if (!isPositiveSafeInteger(categoryId)) {
		return errorHandler(response, 400);
	}

	getCategoryById(categoryId)
		.then(category => response.json(category))
		.then(() => logger.log('Getcategory success!'))
		.catch(err => errorHandler(response, 500, err));
};
