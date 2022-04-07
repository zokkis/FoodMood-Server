import { Request, Response } from 'express';
import { OkPacket } from 'mysql';
import { Food } from '../models/food';
import { defaultHttpResponseMessages } from '../models/httpResponse';
import { DOCUMENT_PATH } from '../utils/constans';
import { databaseQuerry, getCategoryById, getEntityWithId } from '../utils/database';
import { errorHandler, RequestError } from '../utils/error';
import { deletePath } from '../utils/fileAndFolder';
import Logger from '../utils/logger';
import { isPositiveSafeInteger, isValideRating } from '../utils/validator';
import { getSQLAndData, tryParse } from '../utils/parser';
import { IRating } from '../models/rating';

const logger = new Logger('Food');

export const getAllFoods = (request: Request, response: Response): void => {
	const { sql, queryData } = getSQLAndData(request.query, new Food('', -1, {}));

	databaseQuerry<Food[]>('SELECT * FROM entity' + sql, queryData)
		.then(data => response.status(200).json(data))
		.then(() => logger.log('Getfoods success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const getFoodById = (request: Request, response: Response): void => {
	if (!isPositiveSafeInteger(request.params.id)) {
		return errorHandler(response, 400);
	}

	getEntityWithId(request.params.id)
		.then(data => response.status(200).json(data))
		.then(() => logger.log('Getfood success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const addFood = (request: Request, response: Response): void => {
	if (!request.body.title || !isPositiveSafeInteger(request.body.categoryId)) {
		return errorHandler(response, 400);
	}

	const insertFood = Food.getDBFood(request.body);
	getCategoryById(request.body.categoryId)
		.then(() => {
			const rating = request.body.rating;

			if (!rating) {
				return;
			}

			const userId = request.user.userId;
			if (!isValideRating(rating, userId)) {
				throw new RequestError(400);
			}
		})
		.then(() => databaseQuerry<OkPacket>('INSERT INTO entity SET ?', insertFood))
		.then(dbPacket => response.status(201).json({ ...insertFood, entityId: dbPacket.insertId }))
		.then(() => logger.log('Addfood success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const changeFood = (request: Request, response: Response): void => {
	if (!isPositiveSafeInteger(request.params.id) || Object.keys(request.body).length === 0) {
		return errorHandler(response, 400);
	}

	let insertFood: Food;
	getEntityWithId(request.params.id)
		.then(entity => {
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
		.then(entity => {
			insertFood = Food.getDBFood({ ...entity, ...request.body });
			const sqlChangeFood = 'UPDATE entity SET ? WHERE entityId = ?';
			return databaseQuerry<OkPacket>(sqlChangeFood, [insertFood, request.params.id]);
		})
		.then(() => response.status(201).json(insertFood))
		.then(() => logger.log('Changefood success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const deleteFood = (request: Request, response: Response): void => {
	if (!isPositiveSafeInteger(request.params.id)) {
		return errorHandler(response, 400);
	}

	const sqlDeleteFood = 'DELETE FROM entity WHERE entityId = ?';
	databaseQuerry<OkPacket>(sqlDeleteFood, request.params.id)
		.then(() =>
			deletePath(`${DOCUMENT_PATH}/${request.params.id}/`, err => {
				if (err) {
					throw new RequestError(500, err.message);
				} else {
					response.status(202).json(defaultHttpResponseMessages.get(202));
					logger.log('Delete success!');
				}
			})
		)
		.catch(err => errorHandler(response, 500, err));
};

export const rateFood = (request: Request, response: Response): void => {
	if (!isPositiveSafeInteger(request.params.id) || isValideRating(request.body.rating, Number(request.params.id))) {
		return errorHandler(response, 400);
	}

	getEntityWithId(request.params.id)
		.then(food => {
			changeRating(food, request, request.user.userId);
			const sqlChangeRating = 'UPDATE entity SET rating = ? WHERE entityId = ?';
			return databaseQuerry<OkPacket>(sqlChangeRating, [JSON.stringify(food.rating), request.params.id]);
		})
		.then(() => response.status(201).json(defaultHttpResponseMessages.get(201)))
		.then(() => logger.log('Delete success!'))
		.catch(err => errorHandler(response, 500, err));
};

const changeRating = (entity: Food, request: Request, userId: number): void => {
	entity.rating = tryParse<IRating>(entity.rating) || {};
	entity.rating[userId] = request.body.rating[userId];
	delete request.body.rating;
};
