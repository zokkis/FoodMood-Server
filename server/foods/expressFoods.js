const util = require('../util');
const { databaseQuerry } = require('../database');
const Logger = require('../logger');
const { getAllowedFoodProperties } = require('./foods');

const logger = new Logger('Express-Foods');

const functions = {};

functions.getFoods = function (request, response) {
	logger.log('Getfoods');

	let sqlGetFoods = 'SELECT * FROM entity';
	sqlGetFoods += util.isValideSQLTimestamp(request.query?.lastEdit) ? ' WHERE lastEdit >= ?' : '';
	databaseQuerry(sqlGetFoods, request.query?.lastEdit)
		.then(data => response.status(200).send(util.removeEmptyValues(data)))
		.then(() => logger.log('Getfoods success!'))
		.catch(err => util.errorHandler(err, response));
};

functions.addFood = function (request, response) {
	logger.log('Addfood');

	util.deleteNotAllowedProperties(getAllowedFoodProperties(), request.body);
	if (Object.keys(request.body || {}).length === 0) {
		return util.errorHandler('No food to add!', response);
	}

	const sqlInsertFood = 'INSERT INTO entity SET ?';
	databaseQuerry(sqlInsertFood, request.body)
		.then(food => response.status(200).send({ entityId: food.insertId }))
		.then(() => logger.log('Addfood success!'))
		.catch(err => util.errorHandler(err, response));
};

functions.changeFood = function (request, response) {
	logger.log('Changefood');
	if (Object.keys(request.body || {}).length === 0) {
		return util.errorHandler('No food!', response);
	} else if (!request.body.entityId) {
		return util.errorHandler('No id to change!', response);
	}

	const entityId = request.body.entityId;
	util.getEntityWithId(entityId)
		.then(entity => {
			if (entity.length === 0) {
				throw new Error('No food to change!');
			}
		})
		.then(() => {
			let sqlChangeFood = 'UPDATE entity SET ';

			for (const key in request.body) {
				if (getAllowedFoodProperties().includes(key)) {
					sqlChangeFood += key + ' = ?, ';
				} else {
					logger.warn('Too much data in changeFood body!', key);
					delete request.body[key];
				}
			}

			sqlChangeFood = sqlChangeFood.substring(0, sqlChangeFood.length - 2) + ' WHERE entityId = ?';
			return databaseQuerry(sqlChangeFood, [...request.body, entityId]);
		})
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Changefood success!'))
		.catch(err => util.errorHandler(err, response));
};

functions.deleteFood = function (request, response) {
	logger.log('Deletefood');
	if (!request.params?.id) {
		return util.errorHandler('No id to delete!', response);
	}

	const sqlDeleteFood = 'DELETE FROM entity WHERE entityId = ?';
	databaseQuerry(sqlDeleteFood, request.params.id)
		.then(() => util.deletePath(`./documents/${request.params.id}/`))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Delete success'))
		.catch(err => util.errorHandler(err, response));
};

module.exports = functions;