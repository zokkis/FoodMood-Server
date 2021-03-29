use foods;
create table categories (
	categoryId INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
	parentCategoryId INTEGER UNSIGNED,
	title TEXT CHARACTER SET utf8mb4 NOT NULL,
	lastEdit TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
	
	PRIMARY KEY(categoryId),
	FOREIGN KEY(parentCategoryId) REFERENCES categories(categoryId)
);