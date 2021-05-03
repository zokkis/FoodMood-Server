import { Request, Response } from 'express';
import { PermissionNamesType } from '../models/permission';
import { DOCUMENT_PATH } from '../utils/constans';
import { databaseQuerry } from '../utils/database';
import { deletePath } from '../utils/fileAndFolder';
import Logger from '../utils/logger';
import { getPermissionIdsToCheck, getPermissionDetailsOfType } from '../utils/permissions';
import { errorHandler } from '../utils/util';

const logger = new Logger('Document');

export const addDocument = (request: Request, response: Response): void => {
	const type = request.file?.type ?? 'document';

	if (request.fileValidateError) {
		if (request.file?.path) { deletePath(request.file.path); }
		return errorHandler(request.fileValidateError, response);
	} else if (!request.file) {
		return errorHandler(`No ${type} to save!`, response);
	} else if (type === 'document') {
		return errorHandler('Type cant be document!', response);
	}

	const sqlCheckEntitiyId = 'SELECT entityId FROM documents WHERE entityId = ? AND type = ?';
	databaseQuerry(sqlCheckEntitiyId, [request.body.entityId, type])
		.then(data => {
			if (getPermissionIdsToCheck(request.user?.permissions).indexOf(getPermissionDetailsOfType('ADMIN').id) !== -1) {
				return;
			}

			if (data.length >= (getPermissionDetailsOfType(`ADD_${type.toUpperCase()}S` as PermissionNamesType).value || 0)) {
				throw new Error(`Too much ${type}s on this entity!`);
			}
		})
		.then(() => {
			const sqlCreateDocument = 'INSERT INTO documents SET ?';
			databaseQuerry(sqlCreateDocument, { type, name: request.file.filename, entityId: request.body.entityId });
		})
		.then(() => response.sendStatus(200))
		.then(() => logger.log(`Add${type} success`))
		.catch(err => {
			deletePath(request.file.path);
			errorHandler(err.message, response);
		});
};

export const sendDocument = (request: Request, response: Response): void => {
	if (!request.params?.id) {
		return errorHandler('No id!', response);
	}

	const sqlGetImage = 'SELECT name, entityId FROM documents WHERE documentId = ?';
	databaseQuerry(sqlGetImage, request.params.id)
		.then(image => {
			if (image.length !== 1) {
				throw new Error('No document found!');
			}
			image = image[0];
			response.status(200).sendFile(`${process.cwd()}/${DOCUMENT_PATH}/${image.entityId}/${image.name}`);
		})
		.catch(err => errorHandler(err, response));
};

export const deleteDocument = (request: Request, response: Response): void => {
	if (!request.params?.id) {
		return errorHandler('No id to delete!', response);
	}
	let pathToDelete: string;

	const sqlGetDocumentName = 'SELECT name, entityId FROM documents WHERE documentId = ?';
	databaseQuerry(sqlGetDocumentName, request.params.id)
		.then(data => pathToDelete = `${DOCUMENT_PATH}/${data[0].entityId}/${data[0].name}`)
		.then(() => {
			const sqlDeleteDocument = 'DELETE FROM documents WHERE documentId = ?';
			return databaseQuerry(sqlDeleteDocument, request.params.id);
		})
		.then(() => deletePath(pathToDelete))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Document deleted!'))
		.catch(err => errorHandler(err, response));
};