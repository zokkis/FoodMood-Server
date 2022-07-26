import { Request, Response } from 'express';
import { OkPacket } from 'mysql';
import { defaultHttpResponseMessages } from '../models/httpResponse';
import { IDBInsertMessage, Message } from '../models/message';
import { databaseQuerry, getUserById } from '../utils/database';
import { errorHandler, RequestError } from '../utils/error';
import Logger from '../utils/logger';
import { isPositiveSafeInteger } from '../utils/validator';

const logger = new Logger('Message');

export const getMessagesForMe = (request: Request, response: Response): void => {
	const sqlGetMessages = 'SELECT * FROM messages WHERE receiverId = ?';
	databaseQuerry<Message[]>(sqlGetMessages, request.user.userId)
		.then(messages => response.json(messages))
		.then(() => {
			const sqlDeleteMessage = 'DELETE FROM messages WHERE receiverId = ?';
			return databaseQuerry<OkPacket>(sqlDeleteMessage, request.user.userId);
		})
		.then(() => logger.log('Getmessages success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const getOwnMessages = (request: Request, response: Response): void => {
	const sqlGetMessages = 'SELECT * FROM messages WHERE senderId = ?';
	databaseQuerry<Message[]>(sqlGetMessages, request.user.userId)
		.then(messages => response.json(messages))
		.then(() => logger.log('Getownmessages success!'))
		.catch(err => errorHandler(response, 500, err));
};

export const sendMessage = (request: Request, response: Response): void => {
	if (!request.body.message || !isPositiveSafeInteger(request.body.receiverId)) {
		return errorHandler(response, 400);
	}

	delete request.body.messageId;
	const insertMessage = Message.getForDB({ ...request.body, senderId: request.user.userId });
	getUserById(request.body.receiverId)
		.then(() => {
			const addMessage = 'INSERT INTO messages SET ?';
			return databaseQuerry<OkPacket>(addMessage, insertMessage);
		})
		.then(dbPacket => response.status(201).json({ ...insertMessage, messageId: dbPacket.insertId }))
		.then(() => logger.log('Send message success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const editMessage = (request: Request, response: Response): void => {
	const isReceiverIdSave = isPositiveSafeInteger(request.body.receiverId);
	if (!isPositiveSafeInteger(request.body.messageId) || (!request.body.message && !isReceiverIdSave)) {
		return errorHandler(response, 400);
	}
	if (!isReceiverIdSave) {
		delete request.body.receiverId;
	}

	let insertMessage: IDBInsertMessage;
	const sqlGetMessage = 'SELECT senderId, receiverId, message FROM messages WHERE messageId = ?';
	databaseQuerry<Message[]>(sqlGetMessage, request.body.messageId)
		.then(message => {
			if (message.length !== 1) {
				throw new RequestError(422);
			}
			const updateData = Message.getForDB({ ...message[0], isEdited: true });
			if (updateData.senderId !== request.user.userId) {
				throw new RequestError(403);
			}
			if (updateData.receiverId === request.body.receiverId && updateData.message === request.body.message) {
				throw new RequestError(400, 'Edit is not usefull!');
			}
			updateData.receiverId = request.body.receiverId ?? updateData.receiverId;
			updateData.message = request.body.message ?? updateData.message;

			insertMessage = updateData;
			const sqlUpdateMessage = 'UPDATE messages SET ? WHERE messageId = ?';
			return databaseQuerry<OkPacket>(sqlUpdateMessage, [insertMessage, request.body.messageId]);
		})
		.then(() => response.status(201).json({ ...insertMessage, messageId: request.body.messageId }))
		.then(() => logger.log('Edit message success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const deleteMessage = (request: Request, response: Response): void => {
	if (!isPositiveSafeInteger(request.params.id)) {
		return errorHandler(response, 400);
	}

	const sqlDeleteMessage = 'DELETE FROM messages WHERE messageId = ?';
	databaseQuerry<OkPacket>(sqlDeleteMessage, request.params.id)
		.then(() => response.status(202).json(defaultHttpResponseMessages.get(202)))
		.then(() => logger.log('Delete message success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};
