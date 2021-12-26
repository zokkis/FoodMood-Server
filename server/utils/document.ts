import { Request } from 'express';
import multer from 'multer';
import { DOCUMENT_PATH } from './constans';
import { getEntitiesWithId } from './database';
import { mkdirIfNotExist } from './fileAndFolder';
import { isPositiveSaveInteger } from './validator';

mkdirIfNotExist(DOCUMENT_PATH);

export const multerStorage = multer.diskStorage({
	destination: (request, file, cb) => {
		const imageFolder = DOCUMENT_PATH + '/' + request.body.entityId;
		mkdirIfNotExist(imageFolder);
		file.folder = imageFolder;
		cb(null, imageFolder);
	},
	filename: (request, file, cb) => {
		const filename = `${file.fieldname}_${Date.now()}_${Math.round(Math.random() * 1e9)}${file.originalname.substring(
			file.originalname.lastIndexOf('.')
		)}`;
		request.file = request.file || ({} as Express.Multer.File);
		request.file.filename = filename;
		request.file.path = file.folder + '/' + filename;
		cb(null, filename);
	},
});

export const checkFileAndMimetype = (mimetype: string) => {
	return async function (request: Request, file: Express.Multer.File, callback: multer.FileFilterCallback): Promise<void> {
		if (request.fileValidateError || (Array.isArray(request.files) && request.files.length > 1)) {
			request.fileValidateError = `Only one ${mimetype}!`;
			return callback(null, false);
		} else if (!file.mimetype.includes(mimetype)) {
			request.fileValidateError = `Must be ${mimetype}!`;
			return callback(null, false);
		} else if (!isPositiveSaveInteger(request.body.entityId)) {
			request.fileValidateError = 'Error with id!';
			return callback(null, false);
		} else if ((await getEntitiesWithId(request.body.entityId)).length !== 1) {
			request.fileValidateError = 'No entity for this id!';
			return callback(null, false);
		}
		file.type = mimetype;

		request.file = file;
		return callback(null, true);
	};
};
