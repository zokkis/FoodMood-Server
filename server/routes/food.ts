import { Request, Response } from 'express';
import { OkPacket } from 'mysql';
import { Food } from '../models/food';
import { defaultHttpResponseMessages } from '../models/httpResponse';
import { DOCUMENT_PATH } from '../utils/constans';
import { databaseQuerry, getCategoryById, getEntitiesWithId, getEntityWithId, isValideSQLTimestamp } from '../utils/database';
import { errorHandler, RequestError } from '../utils/error';
import { deletePath } from '../utils/fileAndFolder';
import Logger from '../utils/logger';
import { isPositiveSaveInteger, isValideRating, tryParse } from '../utils/validator';

const logger = new Logger('Food');

export const getAllFoods = (request: Request, response: Response): void => {
	const isValideQuery = isValideSQLTimestamp(request.query.lastEdit);

	let sqlGetFoods = 'SELECT * FROM entity';
	sqlGetFoods += isValideQuery ? ' WHERE lastEdit >= ?' : '';
	databaseQuerry(sqlGetFoods, isValideQuery ? request.query.lastEdit : undefined)
		.then((data: Food[]) => response.status(200).json(data))
		.then(() => logger.log('Getfoods success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const getFoodById = (request: Request, response: Response): void => {
	if (!isPositiveSaveInteger(request.params.id)) {
		return errorHandler(response, 400);
	}

	getEntitiesWithId(request.params.id)
		.then((data: Food[]) => response.status(200).json(data))
		.then(() => logger.log('Getfood success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const addFood = (request: Request, response: Response): void => {
	if (!request.body.title || !isPositiveSaveInteger(request.body.categoryId)) {
		return errorHandler(response, 400);
	}

	getCategoryById(request.body.categoryId)
		.then(() => {
			const rating = request.body.rating;

			if (!rating) {
				return;
			}

			const userId = request.user.userId;
			if (!isValideRating(rating, userId)) {
				throw new RequestError(404);
			}
		})
		.then(() => databaseQuerry('INSERT INTO entity SET ?', Food.getDBFood(request.body)))
		.then((dbPacket: OkPacket) => response.status(200).json({ entityId: dbPacket.insertId }))
		.then(() => logger.log('Addfood success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const changeFood = (request: Request, response: Response): void => {
	if (!isPositiveSaveInteger(request.params.id) || Object.keys(request.body).length === 0) {
		return errorHandler(response, 400);
	}

	getEntityWithId(request.params.id)
		.then((entity: Food) => {
			const newRating = request.body.rating;

			if (!newRating) {
				delete request.body.rating;
				return entity;
			}

			const userId = request.user.userId;
			if (!isValideRating(newRating, userId)) {
				throw new RequestError(400);
			}
			changeRating(entity, request, userId);
			return entity;
		})
		.then((entity: Food) => {
			const sqlChangeFood = 'UPDATE entity SET ? WHERE entityId = ?';
			return databaseQuerry(sqlChangeFood, [Food.getDBFood({ ...entity, ...request.body }), request.params.id]);
		})
		.then(() => response.status(201).json(defaultHttpResponseMessages.get(201)))
		.then(() => logger.log('Changefood success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const deleteFood = (request: Request, response: Response): void => {
	if (!isPositiveSaveInteger(request.params.id)) {
		return errorHandler(response, 400);
	}

	const sqlDeleteFood = 'DELETE FROM entity WHERE entityId = ?';
	databaseQuerry(sqlDeleteFood, request.params.id)
		.then(() => deletePath(`${DOCUMENT_PATH}/${request.params.id}/`))
		.then(() => response.status(202).json(defaultHttpResponseMessages.get(202)))
		.then(() => logger.log('Delete success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const rateFood = (request: Request, response: Response): void => {
	if (!isPositiveSaveInteger(request.params.id) || isValideRating(request.body.rating, Number(request.params.id))) {
		return errorHandler(response, 400);
	}

	getEntityWithId(request.params.id)
		.then((food: Food) => {
			changeRating(food, request, request.user.userId);
			const sqlChangeRating = 'UPDATE entity SET rating = ? WHERE entityId = ?';
			return databaseQuerry(sqlChangeRating, [JSON.stringify(food.rating), request.params.id]);
		})
		.then(() => response.status(201).json(defaultHttpResponseMessages.get(201)))
		.then(() => logger.log('Delete success!'))
		.catch(err => errorHandler(response, 500, err));
};

const changeRating = (entity: Food, request: Request, userId: number) => {
	entity.rating = tryParse(entity.rating);
	entity.rating[userId] = request.body.rating[userId];
	delete request.body.rating;
};

