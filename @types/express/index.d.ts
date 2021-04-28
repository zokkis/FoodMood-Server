declare namespace Express {
	export interface Request {
		user?: import('../../server/models/user').LightUser;
	}
}