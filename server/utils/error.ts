import { Response } from 'express';
import { defaultHttpResponseMessages, HTTPResponseTypes } from '../models/httpResponse';
import Logger from './logger';

const logger = new Logger('Errorhandler');

export class RequestError extends Error {
	constructor(
		public statusCode: HTTPResponseTypes,
		public error?: string,
	) {
		super(error || defaultHttpResponseMessages.get(statusCode));
	}
}

export const errorHandler = (response: Response, status: HTTPResponseTypes, err?: RequestError | string): void => {
	logger.error(err || defaultHttpResponseMessages.get(status));
	response.status(status).json(typeof err === 'string' ? err : err?.message || defaultHttpResponseMessages.get(status));
};