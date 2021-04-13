use foods;
create table entity (
	entityId INT UNSIGNED NOT NULL AUTO_INCREMENT,
	title TEXT CHARACTER SET utf8mb4 NOT NULL,
	comment TEXT CHARACTER SET utf8mb4,
	description TEXT CHARACTER SET utf8mb4,
	rating FLOAT,
	categoryId INT UNSIGNED NOT NULL,
	price FLOAT,
	brand TEXT,
	percentage FLOAT,
	contentVolume SMALLINT UNSIGNED, #Inhalt
	lastEdit TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
	
	PRIMARY KEY(entityId),
	FOREIGN KEY(categoryId) REFERENCES categories(categoryId)
);