import { Request, Response } from 'express';
import { OkPacket } from 'mysql';
import { Food } from '../models/food';
import { DOCUMENT_PATH } from '../utils/constans';
import { databaseQuerry, getEntitiesWithId, isValideSQLTimestamp } from '../utils/database';
import { deletePath } from '../utils/fileAndFolder';
import Logger from '../utils/logger';
import { errorHandler, RequestError } from '../utils/error';
import { defaultHttpResponseMessages } from '../models/httpResponse';
import { isPositiveSaveInteger } from '../utils/validator';

const logger = new Logger('Food');

export const getAllFoods = (request: Request, response: Response): void => {
	const isValideQuery = isValideSQLTimestamp(request.query.lastEdit);

	let sqlGetFoods = 'SELECT * FROM entity';
	sqlGetFoods += isValideQuery ? ' WHERE lastEdit >= ?' : '';
	databaseQuerry(sqlGetFoods, isValideQuery ? request.query.lastEdit : undefined)
		.then((data: Food[]) => response.status(200).send(data))
		.then(() => logger.log('Getfoods success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const getFoodById = (request: Request, response: Response): void => {
	if (!isPositiveSaveInteger(request.params.id)) {
		return errorHandler(response, 400);
	}

	getEntitiesWithId(request.params.id)
		.then((data: Food[]) => response.status(200).send(data))
		.then(() => logger.log('Getfood success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const addFood = (request: Request, response: Response): void => {
	if (!request.body.title || !isPositiveSaveInteger(request.body.categoryId)) {
		return errorHandler(response, 400);
	}

	const sqlInsertFood = 'INSERT INTO entity SET ?';
	databaseQuerry(sqlInsertFood, { ...Food.getDBFood(request.body), foodId: undefined })
		.then((dbPacket: OkPacket) => response.status(200).send({ entityId: dbPacket.insertId }))
		.then(() => logger.log('Addfood success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const changeFood = (request: Request, response: Response): void => {
	if (!isPositiveSaveInteger(request.params.id) || Object.keys(request.body).length === 0) {
		return errorHandler(response, 400);
	}

	getEntitiesWithId(request.params.id)
		.then((entity: Food[]) => {
			if (entity.length !== 1) {
				throw new RequestError(400);
			}
			return entity[0];
		})
		.then((entity: Food) => {
			const newFood = Food.getDBFood({ ...entity, ...request.body });

			const sqlChangeFood = 'UPDATE entity SET ? WHERE entityId = ?';
			return databaseQuerry(sqlChangeFood, [{ ...newFood, foodId: undefined }, request.params.id]);
		})
		.then(() => response.status(201).send(defaultHttpResponseMessages.get(201)))
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
		.then(() => response.status(202).send(defaultHttpResponseMessages.get(202)))
		.then(() => logger.log('Delete success!'))
		.catch(err => errorHandler(response, 500, err));
};
