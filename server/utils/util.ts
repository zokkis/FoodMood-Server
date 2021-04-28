import { Response } from 'express';
import Logger from './logger';

const logger = new Logger('Util - DELETEME');

export const errorHandler = (err: Error | string, response?: Response, status = 500): void => {
	// @TODO delte
	logger.error(err);
	if (typeof response?.status === 'function') {
		response.status(status).send(typeof err === 'string' ? err : err.message);
	}
};