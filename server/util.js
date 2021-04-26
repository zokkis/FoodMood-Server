const fs = require('fs');
const { databaseQuerry } = require('./database');
const Logger = require('./logger');

const logger = new Logger('Util');

const functions = {};

functions.deleteNotAllowedProperties = (allowedProps, objToDelete) => {
	if (!Array.isArray(allowedProps)) {
		throw new Error('Properties must be of type array!');
	} else if (!objToDelete) {
		throw new Error('Object must be set!');
	}

	for (const key in objToDelete) {
		if (!allowedProps.includes(key)) {
			logger.warn('Too much data!', key);
			delete objToDelete[key];
		}
	}
	return objToDelete;
};

functions.removeEmptyValues = toRemove => {
	if (!toRemove.forEach) {
		throw new Error('Must have forEach!');
	}

	toRemove.forEach(obj => {
		for (var propName in obj) {
			if (!obj[propName]) {
				delete obj[propName];
			}
		}
	});
	return toRemove;
};

functions.isValideSQLTimestamp = stamp => {
	return typeof stamp === 'string' && /([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):([0-5]\d):([0-5]\d))/.test(stamp);
};

functions.getEntityWithId = async entityId => {
	return databaseQuerry('SELECT * FROM entity WHERE entityId = ?', entityId);
};

functions.deletePath = path => {
	fs.rm(path, { recursive: true, force: true }, err => err ? logger.error(err) : null);
};

functions.errorHandler = (err, response = undefined, status = 500) => {
	logger.error(err);
	if (typeof response?.status === 'function') {
		response.status(status).send(err.message ?? err);
	}
};

module.exports = functions;