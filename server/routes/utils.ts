import { Request, Response } from 'express';
import { Food } from '../models/food';
import { databaseQuerry } from '../utils/database';
import { errorHandler } from '../utils/error';
import Logger from '../utils/logger';
import { isPositiveSafeInteger } from '../utils/validator';

const logger = new Logger('Food-Util');

// gets array of entityIds and send deleted or not know ids back
export const checkFoodIds = (request: Request, response: Response): void => {
	const ids: number[] = Array.from(new Set<number>(request.body.ids));
	if (!ids || ids.length === 0 || !Array.isArray(ids) || ids.find(id => !isPositiveSafeInteger(id))) {
		return errorHandler(response, 400);
	}

	databaseQuerry<Food[]>('SELECT entityId FROM entity WHERE entityId IN ' + JSON.stringify(ids).replace('[', '(').replace(']', ')'))
		.then(entities => {
			const foodIds = entities.map(ent => ent.entityId);
			response.json(ids.filter(id => !foodIds.includes(id)));
		})
		.then(() => logger.log('Deleted Ids success!'))
		.catch(err => errorHandler(response, 500, err));
};
