use foods;
create table users (
	userId INT UNSIGNED NOT NULL AUTO_INCREMENT KEY,
	username VARCHAR(50) CHARACTER SET utf8mb4 NOT NULL UNIQUE,
	password TEXT CHARACTER SET utf8mb4 NOT NULL,
	permissions JSON NOT NULL,
	favorites JSON,
	shoppingList JSON,
	lastEdit TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);