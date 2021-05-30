export type HTTPResponseTypes = 200 | 201 | 202 | 304 | 400 | 401 | 403 | 404 | 409 | 422 | 500 | 502 | 503;

export const defaultHttpResponseMessages: Map<HTTPResponseTypes, string> = new Map([
	[200, 'OK'],
	[201, 'OK - insert/update success'],
	[202, 'OK - delete success'],
	[304, 'Not Modified'],
	[400, 'Bad Request - missing data / wrong data'],
	[401, 'Unauthorized'],
	[403, 'Forbidden - no permissions'],
	[404, 'Not found'],
	[409, 'Conflict'],
	[422, 'Unprocessable Entity - important data is missing or wrong'],
	[500, 'Internal server error'],
	[502, 'Bad Gateway'],
	[503, 'Service Unavailable']
]);