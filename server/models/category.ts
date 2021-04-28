export interface Category {
	categoryId: number;
	title: string;
	parentCategoryId?: number;
	lastEdit?: string;
}