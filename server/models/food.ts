export interface IFood {
	title: string;
	categoryId: number;
	entityId?: number;
	comment?: string;
	description?: string;
	rating?: number;
	price?: number;
	brand?: string;
	percentage?: number;
	contentVolume?: number;
	lastEdit?: string;
}

export class Food implements IFood {
	constructor(
		public title: string,
		public categoryId: number,
		public entityId?: number,
		public comment?: string,
		public description?: string,
		public rating?: number,
		public price?: number,
		public brand?: string,
		public percentage?: number,
		public contentVolume?: number,
		public lastEdit?: string) {
	}

	public static getFromJson(json: Food | IFood): Food {
		return new Food(
			json.title,
			json.categoryId,
			json.entityId,
			json.comment,
			json.description,
			json.rating,
			json.price,
			json.brand,
			json.percentage,
			json.contentVolume
		);
	}

	public static getDBFood(json: Food | IFood): Food {
		const food = this.getFromJson(json);
		delete food.entityId;
		delete food.lastEdit;

		return food;
	}
}