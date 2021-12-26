import { Request, Response } from 'express';
import { OkPacket } from 'mysql';
import { Category } from '../models/category';
import { defaultHttpResponseMessages } from '../models/httpResponse';
import { databaseQuerry, getCategoryById, getEntitiesWithId } from '../utils/database';
import { errorHandler, RequestError } from '../utils/error';
import Logger from '../utils/logger';
import { getSQLAndData } from '../utils/parser';
import { getPermissionDetailsOfType, getPermissionIdsToCheck } from '../utils/permissions';
import { isPositiveSaveInteger } from '../utils/validator';

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

export const deleteCategory = async (request: Request, response: Response): Promise<void> => {
	const categoryId = Number(request.params.id);
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

	getCategoryById(categoryId)
		.then(data => {
			parentId = data?.parentId;

			if (!parentId || parentId === categoryId) {
				if (!canDeleteMain) {
					throw new RequestError(403);
				}
				isMain = true;
			}
			const sqlCheckHasChilds = 'SELECT categoryId FROM categories WHERE parentId = ?';
			return databaseQuerry<Category[]>(sqlCheckHasChilds, categoryId);
		})
		.then(childs => {
			if (childs.length > 0 && !canDeleteWith) {
				throw new RequestError(403);
			}
			const sqlChangeParentId = 'UPDATE categories SET parentId = ? WHERE parentId = ?';
			return databaseQuerry<OkPacket>(sqlChangeParentId, [isMain ? null : parentId, categoryId]);
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
	if (!isPositiveSaveInteger(categoryId) || (!request.body.title && !isPositiveSaveInteger(request.body.parentId))) {
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
	const { sql, queryData } = getSQLAndData(request.query, new Category(-1, ''));

	databaseQuerry<Category[]>('SELECT * FROM categories' + sql, queryData)
		.then(categories => response.status(200).json(categories))
		.then(() => logger.log('Getcategory success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const getCategory = (request: Request, response: Response): void => {
	const categoryId = Number(request.params.id);
	if (!isPositiveSaveInteger(categoryId)) {
		return errorHandler(response, 400);
	}

	getCategoryById(categoryId)
		.then(category => response.status(200).json(category))
		.then(() => logger.log('Getcategory success!'))
		.catch(err => errorHandler(response, 500, err));
};
