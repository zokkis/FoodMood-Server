export const removeLastEdit = <T>(...data: T[]): T[] => {
	// eslint-disable-next-line
	return data.map((d: any) => {
		delete d.lastEdit;
		return d;
	});
};