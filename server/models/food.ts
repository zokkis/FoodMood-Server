export interface Food {
	entityId: number;
	title: string;
	categoryId: number;
	comment?: string;
	description?: string;
	rating?: number;
	price?: number;
	brand?: string;
	percentage?: number;
	contentVolume?: number;
	lastEdit?: string;
}