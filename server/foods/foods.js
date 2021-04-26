const functions = {};

functions.getAllowedFoodProperties = () =>
	['title', 'comment', 'description', 'rating', 'categoryId', 'price', 'brand', 'percentage', 'contentVolume', 'documentIds'];

module.exports = functions;