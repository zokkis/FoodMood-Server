export interface ICategory {
	categoryId: number;
	title: string;
	parentCategoryId?: number;
	lastEdit?: string;
}

export class Category implements ICategory {
	constructor(
		public categoryId: number,
		public title: string,
		public parentCategoryId?: number,
		public lastEdit?: string
	) {
	}

	public static getFromJson(json: Category | ICategory): Category {
		return new Category(
			json.categoryId,
			json.title,
			json.parentCategoryId
		);
	}
}