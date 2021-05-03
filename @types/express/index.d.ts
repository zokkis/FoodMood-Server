declare namespace Express {
	export interface Request {
		user?: import('../../server/models/user').LightUser;
		fileValidateError?: string;
	}
	namespace Multer {
		export interface File {
			folder: string;
			type: string;
		}
	}
}