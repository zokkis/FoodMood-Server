import { Request, Response } from 'express';
import { OkPacket } from 'mysql';
import { Food } from '../models/food';
import { databaseQuerry, getEntityWithId, isValideSQLTimestamp } from '../utils/database';
import Logger from '../utils/logger';
import { errorHandler } from '../utils/util';

const logger = new Logger('Food');

export const getAllFoods = (request: Request, response: Response): void => {
	logger.log('Getfoods');

	let sqlGetFoods = 'SELECT * FROM entity';
	sqlGetFoods += isValideSQLTimestamp(request.query.lastEdit as string) ? ' WHERE lastEdit >= ?' : '';
	databaseQuerry(sqlGetFoods, request.query.lastEdit)
		.then(data => response.status(200).send(data))
		.then(() => logger.log('Getfoods success!'))
		.catch(err => errorHandler(err, response));
};

export const getFoodById = (request: Request, response: Response): void => {
	logger.log('Getfood');
	if (!request.params.id) {
		return errorHandler('No id!', response);
	}

	getEntityWithId(request.params.id)
		.then(data => response.status(200).send(data))
		.then(() => logger.log('Getfoods success!'))
		.catch(err => errorHandler(err, response));
};

export const addFood = (request: Request, response: Response): void => {
	logger.log('Addfood');
	if (!request.body.title || !request.body.categoryId) {
		return errorHandler('Missing data!', response);
	}

	const newFood = Food.getDBFood(request.body);

	const sqlInsertFood = 'INSERT INTO entity SET ?';
	databaseQuerry(sqlInsertFood, newFood)
		.then((food: OkPacket) => response.status(200).send({ entityId: food.insertId }))
		.then(() => logger.log('Addfood success!'))
		.catch(err => errorHandler(err, response));
};

export const changeFood = (request: Request, response: Response): void => {
	logger.log('Changefood');
	if (!request.params.id) {
		return errorHandler('No id to change!', response);
	} else if (Object.keys(request.body || {}).length === 0) {
		return errorHandler('No food!', response);
	}

	const entityId = request.params.id;
	getEntityWithId(entityId)
		.then((entity: Food[]) => {
			if (entity.length === 0) {
				throw new Error('No food to change!');
			}
			return entity[0];
		})
		.then(entity => {
			const newFood = Food.getDBFood({ ...entity, ...request.body });

			const sqlChangeFood = 'UPDATE entity SET ? WHERE entityId = ?';
			return databaseQuerry(sqlChangeFood, [newFood, entityId]);
		})
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Changefood success!'))
		.catch(err => errorHandler(err, response));
};

export const deleteFood = (request: Request, response: Response): void => {
	logger.log('Deletefood');
	if (!request.params?.id) {
		return errorHandler('No id to delete!', response);
	}

	const sqlDeleteFood = 'DELETE FROM entity WHERE entityId = ?';
	databaseQuerry(sqlDeleteFood, request.params.id)
		//.then(() => util.deletePath(`./documents/${request.params.id}/`)) //@TODO delete documents
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Delete success!'))
		.catch(err => errorHandler(err, response));
};
