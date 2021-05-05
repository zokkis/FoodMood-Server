import { Request, Response } from 'express';
import { PermissionNamesType } from '../models/permission';
import { DOCUMENT_PATH } from '../utils/constans';
import { databaseQuerry } from '../utils/database';
import { deletePath } from '../utils/fileAndFolder';
import Logger from '../utils/logger';
import { getPermissionIdsToCheck, getPermissionDetailsOfType } from '../utils/permissions';
import { errorHandler, RequestError } from '../utils/error';
import { Document } from '../models/document';
import { defaultHttpResponseMessages } from '../models/httpResponse';
import { isPositiveSaveInteger } from '../utils/validator';
import { OkPacket } from 'mysql';

const logger = new Logger('Document');

export const addDocument = (request: Request, response: Response): void => {
	const type = request.file?.type ?? 'document';

	if (request.fileValidateError || !isPositiveSaveInteger(request.body.entityId) || !request.file) {
		if (request.file?.path) { deletePath(request.file.path); }
		return errorHandler(response, 400, request.fileValidateError);
	}

	const permissionDetailsOfType = getPermissionDetailsOfType(`ADD_${type.toUpperCase()}S` as PermissionNamesType)?.value;
	if (!permissionDetailsOfType) {
		return errorHandler(response, 500, `Error with type - ${type}`);
	}

	const sqlCheckEntitiyId = 'SELECT entityId FROM documents WHERE entityId = ? AND type = ?';
	databaseQuerry(sqlCheckEntitiyId, [request.body.entityId, type])
		.then((data: Document[]) => {
			if (data.length >= permissionDetailsOfType
				&& getPermissionIdsToCheck(request.user.permissions).indexOf(getPermissionDetailsOfType('ADMIN').id) === -1) {
				throw new RequestError(403, `Too much ${type}s on this entity!`);
			}

			const sqlCreateDocument = 'INSERT INTO documents SET ?';
			return databaseQuerry(sqlCreateDocument, { type, name: request.file.filename, entityId: request.body.entityId });
		})
		.then((dbPacket: OkPacket) => response.status(201).send({ insertId: dbPacket.insertId }))
		.then(() => logger.log(`Add${type} success`))
		.catch(err => {
			deletePath(request.file.path);
			errorHandler(response, err.statusCode || 500, err);
		});
};

export const getDocument = (request: Request, response: Response): void => {
	if (!isPositiveSaveInteger(request.params.id)) {
		return errorHandler(response, 400);
	}

	const sqlGetImage = 'SELECT name, entityId FROM documents WHERE documentId = ?';
	databaseQuerry(sqlGetImage, request.params.id)
		.then((images: Document[]) => {
			if (images.length !== 1) {
				throw new RequestError(400);
			}
			const image = images[0];
			response.status(200).sendFile(`${process.cwd()}/${DOCUMENT_PATH}/${image.entityId}/${image.name}`);
		})
		.then(() => logger.log('Getdocument success!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};

export const deleteDocument = (request: Request, response: Response): void => {
	if (!isPositiveSaveInteger(request.params.id)) {
		return errorHandler(response, 400);
	}
	let pathToDelete: string;

	const sqlGetDocumentName = 'SELECT name, entityId FROM documents WHERE documentId = ?';
	databaseQuerry(sqlGetDocumentName, request.params.id)
		.then((data: Document[]) => {
			if (data.length !== 1) {
				throw new RequestError(400);
			}
			pathToDelete = `${DOCUMENT_PATH}/${data[0].entityId}/${data[0].name}`;
		})
		.then(() => {
			const sqlDeleteDocument = 'DELETE FROM documents WHERE documentId = ?';
			return databaseQuerry(sqlDeleteDocument, request.params.id);
		})
		.then(() => deletePath(pathToDelete))
		.then(() => response.status(202).send(defaultHttpResponseMessages.get(202)))
		.then(() => logger.log('Document deleted!'))
		.catch(err => errorHandler(response, err.statusCode || 500, err));
};