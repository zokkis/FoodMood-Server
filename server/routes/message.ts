import { Request, Response } from 'express';
import { Message } from '../models/message';
import { databaseQuerry, getUserById } from '../utils/database';
import Logger from '../utils/logger';
import { errorHandler, RequestError } from '../utils/error';
import { defaultHttpResponseMessages } from '../models/httpResponse';
import { isPositiveSaveInteger } from '../utils/validator';
import { OkPacket } from 'mysql';

const logger = new Logger('Message');

export const getMessagesForMe = (request: Request, response: Response): void => {
	let messages: Message[];
	const sqlGetMessages = 'SELECT * FROM messages WHERE receiverId = ?';
	databaseQuerry(sqlGetMessages, request.user.userId)
		.then((dbMessages: Message[]) => messages = dbMessages)
		.then(() => {
			const sqlDeleteMessage = 'DELETE FROM messages WHERE receiverId = ?';
			return databaseQuerry(sqlDeleteMessage, request.user.userId);
		})
		.then(() => response.status(200).send(messages))
		.then(() => logger.log('Getmessages success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const getOwnMessages = (request: Request, response: Response): void => {
	const sqlGetMessages = 'SELECT * FROM messages WHERE senderId = ?';
	databaseQuerry(sqlGetMessages, request.user.userId)
		.then((messages: Message[]) => response.status(200).send(messages))
		.then(() => logger.log('Getownmessages success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const sendMessage = (request: Request, response: Response): void => {
	if (!request.body.message || !isPositiveSaveInteger(request.body.receiverId)) {
		return errorHandler(response, 400);
	}

	getUserById(request.body.receiverId)
		.then(() => {
			delete request.body.messageId;
			const addMessage = 'INSERT INTO messages SET ?';
			return databaseQuerry(addMessage, Message.getForDB({ ...request.body, senderId: request.user.userId }));
		})
		.then((dbPacket: OkPacket) => response.status(201).send({ insertId: dbPacket.insertId }))
		.then(() => logger.log('Send message success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const editMessage = (request: Request, response: Response): void => {
	const isReceiverIdSave = isPositiveSaveInteger(request.body.receiverId);
	if (!isPositiveSaveInteger(request.body.messageId) || (!request.body.message && !isReceiverIdSave)) {
		return errorHandler(response, 400);
	}
	if (!isReceiverIdSave) {
		delete request.body.receiverId;
	}

	const sqlGetMessage = 'SELECT senderId, receiverId, message FROM messages WHERE messageId = ?';
	databaseQuerry(sqlGetMessage, request.body.messageId)
		.then((message: Message[]) => {
			if (message.length !== 1) {
				throw new RequestError(422);
			}
			const updateData = Message.getForDB({ ...message[0], edited: true });
			if (updateData.senderId !== request.user.userId) {
				throw new RequestError(403);
			}
			if (updateData.receiverId === request.body.receiverId && updateData.message === request.body.message) {
				throw new RequestError(400, 'Edit is not usefull!');
			}
			updateData.receiverId = request.body.receiverId ?? updateData.receiverId;
			updateData.message = request.body.message ?? updateData.message;

			const sqlUpdateMessage = 'UPDATE messages SET ? WHERE messageId = ?';
			return databaseQuerry(sqlUpdateMessage, [updateData, request.body.messageId]);
		})
		.then(() => response.status(201).send(defaultHttpResponseMessages.get(201)))
		.then(() => logger.log('Edit message success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const deleteMessage = (request: Request, response: Response): void => {
	if (!isPositiveSaveInteger(request.params.id)) {
		return errorHandler(response, 400);
	}

	const sqlDeleteMessage = 'DELETE FROM messages WHERE messageId = ?';
	databaseQuerry(sqlDeleteMessage, request.params.id)
		.then(() => response.status(202).send(defaultHttpResponseMessages.get(202)))
		.then(() => logger.log('Delete message success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};