interface IDBInsertCategory {
	title: string;
	parentId?: number;
}

interface ICategory {
	categoryId: number;
	title: string;
	parentId?: number;
	lastEdit?: string;
}

export class Category implements ICategory {
	constructor(
		public categoryId: number = -1, //
		public title: string = '',
		public parentId?: number,
		public lastEdit?: string
	) {}

	static getDBInsert(json: Category | ICategory): IDBInsertCategory {
		return {
			title: json.title,
			parentId: json.parentId,
		};
	}
}
