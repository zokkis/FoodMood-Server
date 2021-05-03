import { Request } from 'express';
import multer from 'multer';
import { DOCUMENT_PATH } from './constans';
import { getEntitiesWithId } from './database';
import { mkdirIfNotExist } from './fileAndFolder';

mkdirIfNotExist(DOCUMENT_PATH);

export const multerStorage = multer.diskStorage({
	destination: function (request, file, cb) {
		const imageFolder = DOCUMENT_PATH + '/' + request.body.entityId;
		mkdirIfNotExist(imageFolder);
		file.folder = imageFolder;
		cb(null, imageFolder);
	},
	filename: function (request, file, cb) {
		const filename = `${file.fieldname}_${Date.now()}_${Math.round(Math.random() * 1E9)}${file.originalname.substring(file.originalname.lastIndexOf('.'))}`;
		request.file.filename = filename;
		request.file.path = file.folder + '/' + filename;
		cb(null, filename);
	}
});

export const checkFileAndMimetype = (mimetype: string) => {
	return async function (request: Request, file: Express.Multer.File, callback: multer.FileFilterCallback): Promise<void> {
		if (request.fileValidateError || request.files?.length > 1) {
			request.fileValidateError = `Only one ${mimetype}!`;
			return callback(null, false);
		} else if (!file.mimetype.includes(mimetype)) {
			request.fileValidateError = `Must be ${mimetype}!`;
			return callback(null, false);
		} else if (!request.body?.entityId) {
			request.fileValidateError = 'No entityId to save!';
			return callback(null, false);
		} else if ((await getEntitiesWithId(request.body.entityId)).length === 0) {
			request.fileValidateError = 'No entity for this id!';
			return callback(null, false);
		}
		file.type = mimetype;

		request.file = file;
		return callback(null, true);
	};
};