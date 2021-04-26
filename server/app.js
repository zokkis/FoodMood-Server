const express = require('express');
const cors = require('cors');
const Logger = require('./logger');
const fs = require('fs');
const https = require('https');
const perms = require('./permissions.json');
const package = require('../package.json');
const { program, Option } = require('commander');
const { updateCachedUser } = require('./users/cachedUsers');
const { databaseQuerry } = require('./database');
const _ = require('lodash');
const multer = require('multer');
const expressUser = require('./users/expressUser');
const expressFood = require('./foods/expressFoods');

program
	.addOption(new Option('-d, --dev', 'run in dev').default(false))
	.parse();

const options = program.opts();
const logger = new Logger('App');
const app = express();

app.use(cors());
app.use(express.json());
app.use(expressUser.checkAuth);

https.createServer({
	key: fs.readFileSync('./private_files/private.pem'),
	cert: fs.readFileSync('./private_files/cert.pem')
}, app)
	.listen(3000, () => logger.log('Server started!'));

app.get('/', (request, response) => {
	logger.log('Root', request.ip);
	response.status(200).send('<strong>ONLINE</strong>');
});

app.get('/info', (request, response) => {
	logger.log('Info');
	response.status(200).send({ isOnline: true, version: package.version, isDev: options.dev });
});

app.post('/register', expressUser.register);

app.get('/login', (request, response) => {
	logger.log('Login', request.user);
	response.status(200).send(request.user);
});

app.delete('/deleteuser', expressUser.deleteUser);

app.put('/changepassword', hasPerms(perms.EDIT_PASSWORD), expressUser.changePassword);

app.put('/changeusername', hasPerms(perms.EDIT_USERNAME), expressUser.changeUsername);

app.delete('/logout', expressUser.logout);

app.get('/getfoods', hasPerms(perms.VIEW_FOOD), expressFood.getFoods);

app.post('/addfood', hasPerms(perms.ADD_FOOD), expressFood.addFood);

app.put('/changefood', hasPerms(perms.CHANGE_FOOD), expressFood.changeFood);

app.delete('/deletefood/:id', hasPerms(perms.DELETE_FOOD), expressFood.deleteFood);

if (!fs.existsSync('./documents')) {
	fs.mkdirSync('./documents');
}
const multerStorage = multer.diskStorage({
	destination: function (request, file, cb) {
		const imageFolder = './documents/' + request.body.entityId;
		if (!fs.existsSync(imageFolder)) {
			fs.mkdirSync(imageFolder);
		}
		request.file.folder = imageFolder;
		cb(null, imageFolder);
	},
	filename: function (request, file, cb) {
		const filename = `${file.fieldname}_${Date.now()}_${Math.round(Math.random() * 1E9)}${file.originalname.substring(file.originalname.lastIndexOf('.'))}`;
		request.file.filename = filename;
		request.file.path = request.file.folder + '/' + filename;
		cb(null, filename);
	}
});
app.post('/addimage',
	hasPerms(perms.ADD_IMAGES),
	multer({ dest: 'documents/', fileFilter: checkFileAndMimetype('image'), storage: multerStorage }).any(),
	addDocument
);

app.put('/getimage', hasPerms(perms.VIEW_IMAGES), (request, response) => {
	logger.log('Getimage');
	sendDocument(request, response);
});

app.put('/deleteimage', hasPerms(perms.DELETE_IMAGES), deleteDocument);

app.post('/addvideo',
	hasPerms(perms.ADD_VIDEOS),
	multer({ dest: 'documents/', fileFilter: checkFileAndMimetype('video'), storage: multerStorage }).any(),
	addDocument
);

app.put('/getvideo', hasPerms(perms.VIEW_VIDEOS), (request, response) => {
	logger.log('Getvideo');
	sendDocument(request, response);
});

app.put('/deletevideo', hasPerms(perms.DELETE_VIDEOS), deleteDocument);

app.post('/addcategory', hasPerms(perms.CREATE_CATEGORY), (request, response) => {
	logger.log('Addcategory', request.body);
	if (!request.body) {
		return errorHanlder('No category to add!', response);
	}

	for (const key in request.body) {
		if (!getAllowedCategoryProperties().includes(key)) {
			logger.warn('Too much data in addcategory body!', key);
			delete request.body[key];
		}
	}

	const sqlToAdd = 'INSERT INTO categories SET ?';
	databaseQuerry(sqlToAdd, { ...request.body })
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Addcategory success'))
		.catch((err) => errorHanlder(err, response));
});

app.put('/deletecategory', async (request, response) => {
	logger.log('Deletecategory', request.body);
	const categoryId = request.body?.categoryId;
	if (!categoryId) {
		return errorHanlder('No id to delete!', response);
	}

	const sqlCheckCategoriesOfFoods = 'SELECT categoryId FROM entity WHERE categoryId = ?';
	if ((await databaseQuerry(sqlCheckCategoriesOfFoods, categoryId)).length !== 0) {
		return errorHanlder('There is a food with this id! -> refactor this!', response);
	}

	const permsToCheck = getPermsToCheck(request.user.permissions);
	const canDeleteMain = containsOnePerm(permsToCheck, perms.DELETE_CATEGORY_MAIN);
	const canDeleteWith = containsOnePerm(permsToCheck, perms.DELETE_CATEGORY_WITH_CHILD);
	const canDeleteLast = containsOnePerm(permsToCheck, perms.DELETE_CATEGORY_LAST_CHILD);

	if (!canDeleteMain && !canDeleteLast && !canDeleteWith) {
		return errorHanlder('No permissions to delete!', response);
	}

	let isMain = false;
	let parentId;

	const sqlDeleteCategory = 'SELECT parentCategoryId FROM categories WHERE categoryId = ?';
	databaseQuerry(sqlDeleteCategory, categoryId)
		.then(data => {
			if (data.length !== 1) {
				throw new Error(data.length === 0 ? 'No category for this id!' : 'Internal error with this id!');
			}
			parentId = data[0].parentCategoryId;

			if (parentId === null || parentId === categoryId) {
				if (!canDeleteMain) {
					throw new Error('No permissions to delete main-category!');
				}
				this.isMain = true;
			}
			const sqlCheckHasChilds = 'SELECT categoryId FROM categories WHERE parentCategoryId = ?';
			databaseQuerry(sqlCheckHasChilds, categoryId);
		})
		.then(childs => {
			if (childs.length > 0 && !canDeleteWith) {
				throw new Error('No permissions to delete category with childs!');
			}
			const sqlChangeParentId = 'UPDATE categories SET parentCategoryId = ? WHERE parentCategoryId = ?';
			databaseQuerry(sqlChangeParentId, [isMain ? null : parentId, categoryId]);
		})
		.then(() => {
			const sqlDeleteCategory = 'DELETE FROM categories WHERE categoryId = ?';
			databaseQuerry(sqlDeleteCategory, categoryId);
		})
		.catch(err => errorHanlder(err, response));
});

app.put('/changecategory', hasPerms(perms.EDIT_CATEGORY), (request, response) => {
	logger.log('Changecategory', request.body);
	const categoryId = request.body?.categoryId;
	if (!categoryId) {
		return errorHanlder('No id to change!', response);
	} else if (!request.body?.newTitle && !request.body?.newParentId) {
		return errorHanlder('No new value!', response);
	}

	let sqlChangeCategory = 'UPDATE categories SET ';
	const insetValues = [];

	if (request.body?.newTitle) {
		sqlChangeCategory += request.body.newTitle + ' = ?, ';
		insetValues.push(request.body.newTitle);
	}

	if (request.body?.newParentId) {
		sqlChangeCategory += request.body.newParentId + ' = ?, ';
		insetValues.push(request.body.newParentId);
	}

	sqlChangeCategory = sqlChangeCategory.substring(0, sqlChangeCategory.length - 2) + ' WHERE categoryId = ?';
	databaseQuerry(sqlChangeCategory, [...insetValues, categoryId])
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Changecategory success!'))
		.catch((err) => errorHanlder(err, response));
});

app.put('/getcategories', (request, response) => {
	logger.log('Getcategories');

	let sqlGetCategories = 'SELECT * FROM categories';
	sqlGetCategories += isValideSQLTimestamp(request.body.lastEdit) ? ' WHERE lastEdit >= ?' : '';
	databaseQuerry(sqlGetCategories, request.body.lastEdit)
		.then(categories => {
			for (const cat of categories) {
				delete cat.lastEdit;
			}
			response.status(200).send(categories);
		})
		.catch(() => errorHanlder('Error while getting categories!', response));
});

app.put('/getusers', hasPerms(perms.VIEW_USERS), (request, response) => {
	logger.log('Getusers');

	let sqlGetUsers = 'SELECT lastEdit, username, userId FROM users';
	sqlGetUsers += isValideSQLTimestamp(request.body.lastEdit) ? ' WHERE lastEdit >= ?' : '';
	databaseQuerry(sqlGetUsers, request.body.lastEdit)
		.then(users => response.status(200).send(users))
		.catch(() => errorHanlder('Error while getting users!', response));
});

app.put('/getfavorites', hasPerms(perms.VIEW_USERS, perms.VIEW_USERS_FAVORITES), (request, response) => {
	logger.log('Getfavorites', request.body);
	const userId = request.body?.userId;
	if (!userId) {
		return errorHanlder('No userId!', response);
	}

	let sqlGetFavorites = 'SELECT lastEdit, favorites FROM users WHERE userId = ?';
	sqlGetFavorites += isValideSQLTimestamp(request.body.lastEdit) ? ' WHERE lastEdit >= ?' : '';
	databaseQuerry(sqlGetFavorites, [userId, request.body.lastEdit])
		.then(favs => response.status(200).send(favs))
		.catch(() => errorHanlder('Error while getting favorites!', response));
});

app.post('/addfavorite', async (request, response) => {
	logger.log('Addfavorite', request.body);
	const foodId = request.body?.foodId;
	if (!foodId) {
		return errorHanlder('No foodId to add!', response);
	}
	let favorites = JSON.parse(request.user.favorites || '[]');

	if (favorites.includes(foodId)) {
		return errorHanlder('Id already a fav!', response);
	} else if ((await databaseQuerry('SELECT entityId FROM entity WHERE entityId = ?', foodId)).length === 0) {
		return errorHanlder('No entity for this id!', response);
	}
	favorites.push(foodId);
	favorites = JSON.stringify(favorites);

	const sqlUpdateFavs = 'UPDATE users SET favorites = ? WHERE userId = ?';
	databaseQuerry(sqlUpdateFavs, [favorites, request.user.userId])
		.then(() => updateCachedUser(request.user.username, { favorites }))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Add fav success!'))
		.catch(() => errorHanlder('Error while add fav!', response));
});

app.put('/deletefavorite', (request, response) => {
	logger.log('Deletefavorite', request.body);
	const foodId = request.body?.foodId;
	if (!foodId) {
		return errorHanlder('No foodId to delete!', response);
	}
	let favorites = JSON.parse(request.user.favorites || '[]');

	if (!favorites.includes(foodId)) {
		return errorHanlder('Id not in favs!', response);
	}

	// remove from array function
	favorites = JSON.stringify(favorites.filter(favId => favId !== foodId));

	const sqlUpdateFavs = 'UPDATE users SET favorites = ? WHERE userId = ?';
	databaseQuerry(sqlUpdateFavs, [favorites, request.user.userId])
		.then(() => updateCachedUser(request.user.username, { favorites }))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Add fav success!'))
		.catch(() => errorHanlder('Error while add fav!', response));
});

app.post('/addshoppeinglist', async (request, response) => {
	logger.log('Addshoppeinglist', request.body);
	const foodId = request.body?.foodId;
	const amount = request.body?.amount;
	if (!foodId || !amount) {
		return errorHanlder('No foodId or amount to add!', response);
	}
	let shoppingList = JSON.parse(request.user.shoppingList || '[]');

	if (shoppingList.find(list => list.foodId === foodId)) {
		return errorHanlder('Id already in shoppingList!', response);
	} else if ((await databaseQuerry('SELECT entityId FROM entity WHERE entityId = ?', foodId)).length === 0) {
		return errorHanlder('No entity for this id!', response);
	}

	shoppingList.push({ foodId, amount: amount ?? 1 });
	shoppingList = JSON.stringify(shoppingList);

	const sqlUpdateList = 'UPDATE users SET shoppingList = ? WHERE userId = ?';
	databaseQuerry(sqlUpdateList, [shoppingList, request.user.userId])
		.then(() => updateCachedUser(request.user.username, { shoppingList }))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Add shoppingList success!'))
		.catch(() => errorHanlder('Error while add shoppingList!', response));
});

app.put('/deleteshoppinglist', (request, response) => {
	logger.log('Deleteshoppinglist', request.body);
	const foodId = request.body?.foodId;
	if (!foodId) {
		return errorHanlder('No foodId to delete!', response);
	}
	let shoppingList = JSON.parse(request.user.shoppingList || '[]');

	if (!shoppingList.find(list => list.foodId === foodId)) {
		return errorHanlder('Id isn\'t in shoppingList!', response);
	}

	shoppingList = JSON.stringify(shoppingList.filter(list => list.foodId !== foodId));

	const sqlDeleteList = 'UPDATE users SET shoppingList = ? WHERE userId = ?';
	databaseQuerry(sqlDeleteList, [shoppingList, request.user.userId])
		.then(() => updateCachedUser(request.user.username, { shoppingList }))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Delete shoppingList success!'))
		.catch(() => errorHanlder('Error while delete shoppingList!', response));
});

app.post('/sendmessage', hasPerms(perms.SEND_MESSAGES), (request, response) => {
	logger.log('Sendmessage');
	if (!request.body?.message) {
		return errorHanlder('No message to send!', response);
	} else if (!request.body.receiverId) {
		return errorHanlder('No receiver set!', response);
	}
	//Refactor -> use cache
	const sqlCheckIsUser = 'SELECT userId FROM users WHERE userId = ?';
	databaseQuerry(sqlCheckIsUser, request.body.receiverId)
		.then(user => {
			if (user.length !== 1) {
				throw new Error('No user to this id!');
			}
			const addMessage = 'INSERT INTO messages SET ?';
			databaseQuerry(addMessage, { senderId: request.user.userId, receiverId: request.body.receiverId, message: request.body.message });
		})
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Send message success!'))
		.catch(err => errorHanlder(err.message, response));
});

app.put('/editmessage', hasPerms(perms.EDIT_MESSAGES), (request, response) => {
	logger.log('Editmessage');
	if (!request.body?.messageId) {
		return errorHanlder('No id to edit!', response);
	} else if (!request.body.newMessage && !request.body.newReceiverId) {
		return errorHanlder('No data to edit!', response);
	}

	const sqlGetMessage = 'SELECT senderId, receiverId, message FROM messages WHERE messageId = ?';
	databaseQuerry(sqlGetMessage, request.body.messageId)
		.then(message => {
			if (message.length === 0) {
				throw new Error('No message with this id!');
			}
			message = message[0];
			if (message.senderId !== request.user.userId) {
				throw new Error('You cant edit this message!');
			}
			if (message.receiverId === request.body.newReceiverId && message.message === request.body.newMessage) {
				throw new Error('Edit is not usefull!');
			}
			const updateData = { edited: true };
			if (request.body.newReceiverId) {
				updateData.receiverId = request.body.newReceiverId;
			}
			if (request.body.newMessage) {
				updateData.message = request.body.newMessage;
			}

			const sqlUpdateMessage = 'UPDATE messages SET ? WHERE messageId = ?';
			databaseQuerry(sqlUpdateMessage, [updateData, request.body.messageId]);
		})
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Edit message success!'))
		.catch(err => errorHanlder(err.message, response));
});

app.get('/getmymessages', (request, response) => {
	logger.log('Getmymessages');

	const sqlGetMessages = 'SELECT * FROM messages WHERE receiverId = ?';
	databaseQuerry(sqlGetMessages, request.user.userId)
		.then(messages => response.status(200).send(messages))
		.then(() => {
			const sqlDeleteMessage = 'DELETE FROM messages WHERE receiverId = ?';
			databaseQuerry(sqlDeleteMessage, request.user.userId);
		})
		.catch(() => errorHanlder('Error while getting messages!', response));
});

app.get('/getsendedmessages', (request, response) => {
	logger.log('Getsendedmessages');

	const sqlGetMessages = 'SELECT * FROM messages WHERE senderId = ?';
	databaseQuerry(sqlGetMessages, request.user.userId)
		.then(messages => response.status(200).send(messages))
		.catch(() => errorHanlder('Error while getting messages!', response));
});

function addDocument(request, response) {
	const type = request.file?.type ?? 'document';
	logger.log(`Add${type}`, request.file);
	if (request.files?.length > 1) {
		request.files?.forEach(file => deletePath(file.path));
		return errorHanlder(`Only one ${type}!`, response);
	} else if (request.fileValidateError) {
		request.files?.forEach(file => deletePath(file.path));
		return errorHanlder(request.fileValidateError, response);
	} else if (!request.file) {
		return errorHanlder(`No ${type} to save!`, response);
	} else if (type === 'document') {
		return errorHanlder('Type cant be documente!', response);
	}

	const sqlCheckEntitiyId = 'SELECT entityId FROM documents WHERE entityId = ? AND type = ?';
	databaseQuerry(sqlCheckEntitiyId, [request.body.entityId, type])
		.then(data => {
			if (data.length >= getPermsToCheck(request.user.permissions).find(perm => perm.id === perms[`ADD_${type.toUpperCase()}S`].id)?.value) {
				throw new Error(`Too much ${type}s on this entity!`);
			}
			const sqlCreateDocument = 'INSERT INTO documents SET ?';
			databaseQuerry(sqlCreateDocument, { type, name: request.file.filename, entityId: request.body.entityId });
		})
		.then(() => response.sendStatus(200))
		.then(() => logger.log(`Add${type} success`))
		.catch(err => {
			fs.rm(request.file.path, () => { });
			errorHanlder(err.message, response);
		});
}

const sendDocument = (request, response) => {
	if (!request.body?.documentId) {
		return errorHanlder('No documentId!', response);
	}

	const sqlGetImage = 'SELECT name, entityId FROM documents WHERE documentId = ?';
	databaseQuerry(sqlGetImage, request.body.documentId)
		.then(image => {
			if (image.length !== 1) {
				throw new Error('No document found!');
			}
			image = image[0];
			// eslint-disable-next-line
			response.status(200).sendFile(`${__dirname}/documents/${image.entityId}/${image.name}`);
		})
		.catch(() => errorHanlder('Error while getting document!', response));
};

function deleteDocument(request, response) {
	logger.log('Deletedocument', request.body?.documentId);
	if (!request.body?.documentId) {
		return errorHanlder('No id to delete!', response);
	}
	let pathToDelete;

	const sqlGetDocumentName = 'SELECT name, entityId FROM documents WHERE documentId = ?';
	databaseQuerry(sqlGetDocumentName, request.body.documentId)
		.then(data => pathToDelete = `./documents/${data[0].entityId}/${data[0].name}`)
		.then(() => {
			const sqlDeleteDocument = 'DELETE FROM documents WHERE documentId = ?';
			databaseQuerry(sqlDeleteDocument, request.body.documentId);
		})
		.then(() => deletePath(pathToDelete))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Document deleted!'))
		.catch(() => errorHanlder('No entity for this id!', response));
}

const errorHanlder = (err, response = undefined, status = 500) => {
	logger.error(err);
	if (typeof response?.status === 'function') {
		response.status(status).send(err);
	}
};

function hasPerms(...perms) {
	return function (request, response, next) {
		logger.log('Check that', request.user, 'has', perms);

		if (!containsAllPerms(getPermsToCheck(request.user.permissions), perms)) {
			return errorHanlder('No permissions for this action!', response, 403);
		}
		logger.log('Permcheck success');
		next();
	};
}

const containsAllPerms = (have, mustHave) => {
	have = have.map(perm => perm.id ?? perm);
	if (have.indexOf(perms.ADMIN.id) !== -1) {
		return true;
	}
	for (const must of mustHave) {
		if (have.indexOf(must.id) === -1) {
			return false;
		}
	}
	return true;
};

const containsOnePerm = (have, mustHave) => {
	have = have.map(perm => perm.id ?? perm);
	return have.indexOf(mustHave.id) !== -1;
};

const getDefaultPermissions = () => {
	const retPerms = [];
	for (let perm in perms) {
		perm = _.clone(perms[perm]);
		perm.isDefault ? retPerms.push(perm) : null;
	}
	return retPerms.map(perm => {
		delete perm.isDefault;
		return perm.value ? perm : perm.id;
	});
};

const getAllowedCategoryProperties = () => ['parentCategoryId', 'title'];

function checkFileAndMimetype(mimetype) {
	return async function (request, file, callback) {
		if (request.fileValidateError) {
			request.fileValidateError = `Only one ${mimetype}!`;
			return callback(null, false);
		} else if (!file.mimetype.includes(mimetype)) {
			request.fileValidateError = `Must be ${mimetype}!`;
			return callback(null, false);
		} else if (!request.body?.entityId) {
			request.fileValidateError = 'No entityId to save!';
			return callback(null, false);
		} else if ((await databaseQuerry('SELECT entityId FROM entity WHERE entityId = ?', request.body.entityId)).length === 0) {
			request.fileValidateError = 'No entity for this id!';
			return callback(null, false);
		}
		file.type = mimetype;

		request.file = file;
		return callback(null, true);
	};
}

const deletePath = path => {
	fs.rm(path, { recursive: true, force: true }, err => err ? logger.error(err) : null);
};

const isValideSQLTimestamp = stamp => {
	return typeof stamp === 'string' && /([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):([0-5]\d):([0-5]\d))/.test(stamp);
};

const getPermsToCheck = perms => {
	return JSON.parse(perms).isDefault ? getDefaultPermissions() : JSON.parse(perms);
};