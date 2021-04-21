const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const Logger = require('./logger');
const fs = require('fs');
const https = require('https');
const perms = require('./permissions.json');
const package = require('./package.json');
const { program, Option } = require('commander');
const { addCachedUser, resetCacheTimeOf, getCachedUsers, prepareUserToSend, deleteCachedUser, getAllowedProperties, updateCachedUser } = require('./users');
const { databaseQuerry } = require('./database');
const _ = require('lodash');
const multer = require('multer');

program
	.addOption(new Option('-d, --dev', 'run in dev').default(false))
	.parse();

const options = program.opts();
const logger = new Logger('App');
const app = express();

app.use(cors());
app.use(express.json());
app.use(checkAuth);

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

app.post('/register', (request, response) => {
	logger.log('Register', request.body);
	if (!request.body?.username || !request.body.password) {
		return errorHanlder('Missing username or password!', response);
	}

	bcrypt.hash(request.body.password, 10)
		.then(salt => {
			for (const key in request.body) {
				if (!getAllowedProperties().includes(key)) {
					logger.warn('Too much data in register body!', key);
					delete request.body[key];
				}
			}
			request.body.permissions = JSON.stringify({ isDefault: true });

			const sqlInsertUser = 'INSERT INTO users SET ?';
			databaseQuerry(sqlInsertUser, { ...request.body, password: salt })
				.then(() => response.sendStatus(200))
				.then(() => logger.log('Register success'))
				.catch(() => errorHanlder('Error! Username already taken!', response));
		})
		.catch(() => errorHanlder('Error while creating salt!', response));
});

app.get('/login', (request, response) => {
	logger.log('Login', request.user);
	response.status(200).send(request.user);
});

app.delete('/deleteuser', (request, response) => {
	logger.log('Delete User', request.user);
	const sqlDeleteUser = 'DELETE FROM users WHERE username = ?';
	databaseQuerry(sqlDeleteUser, request.user.username)
		.then(() => deleteCachedUser(request.user.username))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Delete success'))
		.catch(() => errorHanlder('Error! While deleting!', response));
});

app.put('/changepassword', hasPerms(perms.EDIT_PASSWORD), (request, response) => {
	logger.log('Changepassword', request.user);
	if (!request.body?.newPassword) {
		return errorHanlder('Empty newPassword!', response);
	}

	bcrypt.hash(request.body.newPassword, 10)
		.then(salt => {
			const sqlChangePassword = 'UPDATE users SET password = ? WHERE username = ?';
			databaseQuerry(sqlChangePassword, [salt, request.user.username])
				.then(() => updateCachedUser(request.user.username, { password: salt }))
				.then(() => response.sendStatus(200))
				.then(() => logger.log('Change success'))
				.catch(() => errorHanlder('Error while changing password!', response));
		})
		.catch(() => errorHanlder('Error while creating salt!', response));
});

app.put('/changeusername', hasPerms(perms.EDIT_USERNAME), (request, response) => {
	logger.log('Changeusername', request.user, request.body?.newUsername);
	if (!request.body?.newUsername) {
		return errorHanlder('Empty new username!', response);
	}

	const sqlChangeUsername = 'UPDATE users SET username = ? WHERE username = ?';
	databaseQuerry(sqlChangeUsername, [request.body.newUsername, request.user.username])
		.then(() => updateCachedUser(request.user.username, { username: request.body.newUsername }))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Change success'))
		.catch(() => errorHanlder('Error while changing username!', response));
});

app.delete('/logout', (request, response) => {
	logger.log('Logout', request.user.username);
	deleteCachedUser(request.user.username);
	response.sendStatus(200);
});

app.get('/getfoods', hasPerms(perms.VIEW_FOOD), (request, response) => {
	logger.log('Getfoods', request.user);

	let sqlGetFoods = 'SELECT * FROM entity';
	sqlGetFoods += isValideSQLTimestamp(request.body.lastEdit) ? ' WHERE lastEdit >= ?' : '';
	databaseQuerry(sqlGetFoods, request.body.lastEdit)
		.then(data => {
			data.forEach(obj => {
				for (var propName in obj) {
					if (!obj[propName]) {
						delete obj[propName];
					}
				}
			});
			response.status(200).send(data);
		})
		.then(() => logger.log('Get success'))
		.catch(() => errorHanlder('Error while getting foods!', response));
});

app.post('/addfood', hasPerms(perms.ADD_FOOD), (request, response) => {
	logger.log('Addfood', request.body);
	if (!request.body) {
		return errorHanlder('No food!', response);
	}

	for (const key in request.body) {
		if (!getAllowedEntityProperties().includes(key)) {
			logger.warn('Too much data in addFood body!', key);
			delete request.body[key];
		}
	}

	const sqlInsertFood = 'INSERT INTO entity SET ?';
	databaseQuerry(sqlInsertFood, request.body)
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Insert success'))
		.catch((err) => errorHanlder(err, response));
});

app.put('/changefood', hasPerms(perms.CHANGE_FOOD), (request, response) => {
	logger.log('Changefood', request.body);
	if (!request.body) {
		return errorHanlder('No food!', response);
	} else if (!request.body.idToChange || Number.isNaN(Number.parseInt(request.body.idToChange))) {
		return errorHanlder('No id to change!', response);
	}
	const idToChange = request.body.idToChange;
	let sqlChangeFood = 'UPDATE entity SET ';
	const insetValues = [];

	for (const key in request.body) {
		if (getAllowedEntityProperties().includes(key)) {
			sqlChangeFood += key + ' = ?, ';
			insetValues.push(request.body[key]);
		} else {
			logger.warn('Too much data in changeFood body!', key);
			delete request.body[key];
		}
	}

	sqlChangeFood = sqlChangeFood.substring(0, sqlChangeFood.length - 2) + ' WHERE entityId = ?';
	databaseQuerry(sqlChangeFood, [...insetValues, idToChange])
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Changefood success'))
		.catch((err) => errorHanlder(err, response));
});

app.put('/deletefood', hasPerms(perms.DELETE_FOOD), (request, response) => {
	logger.log('Deletefood', request.body);
	if (!request.body?.idToDelete) {
		return errorHanlder('No id to delete!', response);
	}

	const sqlDeleteFood = 'DELETE FROM entity WHERE entityId = ?';
	databaseQuerry(sqlDeleteFood, request.body.idToDelete)
		.then(() => deletePath(`./documents/${request.body.idToDelete}/`))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Delete success'))
		.catch((err) => errorHanlder(err, response));
});

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
	checkAuth,
	hasPerms(perms.ADD_IMAGES),
	multer({ dest: 'documents/', fileFilter: checkFileAndMimetype('image'), storage: multerStorage }).any(),
	addDocument
);

app.put('/deleteimage', hasPerms(perms.DELETE_IMAGES), deleteDocument);

app.post('/addvideo',
	hasPerms(perms.ADD_VIDEOS),
	multer({ dest: 'documents/', fileFilter: checkFileAndMimetype('video'), storage: multerStorage }).any(),
	addDocument
);

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

	const permsToCheck = JSON.parse(request.user.permissions).isDefault ? getDefaultPermissions() : JSON.parse(request.user.permissions);
	const canDeleteMain = containsOnePerm(permsToCheck, perms.DELETE_CATEGORY_MAIN);
	const canDeleteWith = containsOnePerm(permsToCheck, perms.DELETE_CATEGORY_WITH_CHILD);
	const canDeleteLast = containsOnePerm(permsToCheck, perms.DELETE_CATEGORY_LAST_CHILD);

	if (!canDeleteMain && !canDeleteLast && !canDeleteWith) {
		return errorHanlder('No permissions to delete!', response);
	}

	let isMain = false;
	let parentId;

	const sqlGetCategory = 'SELECT parentCategoryId FROM categories WHERE categoryId = ?';
	databaseQuerry(sqlGetCategory, categoryId)
		.then(data => {
			if (data.length !== 1) {
				throw new Error(data.length === 0 ? 'No category for this id!' : 'Internal error with this id!');
			}
			parentId = data[0].parentCategoryId;
		})
		.then(() => {
			if (parentId === null || parentId === categoryId) {
				if (!canDeleteMain) {
					throw new Error('No permissions to delete main-category!');
				}
				this.isMain = true;
			}
		})
		.then(() => {
			const sqlCheckHasChilds = 'SELECT categoryId FROM categories WHERE parentCategoryId = ?';
			databaseQuerry(sqlCheckHasChilds, categoryId);
		})
		.then(childs => {
			if (childs.length > 0 && !canDeleteWith) {
				throw new Error('No permissions to delete category with childs!');
			}
		})
		.then(() => {
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

app.put('/getusers', hasPerms(perms.VIEW_USERS), (request, response) => {
	logger.log('Getusers');

	let sqlGetUsers = 'SELECT username, userId FROM users';
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

	let sqlGetFavorites = 'SELECT favorites FROM users WHERE userId = ?';
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

	favorites = JSON.stringify([...favorites, foodId]);

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

	shoppingList = JSON.stringify([...shoppingList, { foodId, amount }]);

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
			if (data.length >= JSON.parse(request.user.permissions).find(perm => perm.id === perms[`ADD_${type.toUpperCase()}S`].id).value) {
				throw new Error(`Too much ${type}s on this entity!`);
			}
		})
		.then(() => {
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

function checkAuth(request, response, next) {
	logger.log(`${request.ip} try to connect!`);
	if (['/', '/info', '/register'].includes(request.url)) {
		return next();
	}

	logger.log('Check Auth of', request.headers.authorization);
	if (!request.headers.authorization) {
		return errorHanlder(`Authentication required for ${request.url}!`, response, 400);
	}

	const b64auth = request.headers.authorization.split(' ')[1];
	// eslint-disable-next-line
	const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':');
	if (!username || !password) {
		return errorHanlder('Username or password is missing!', response, 400);
	}

	checkAuthOf(username, password, request, response, next);
}

const checkAuthOf = async (username, password, request, response, next) => {
	let user = getCachedUsers().find(user => user.username === username);
	const isCached = !user;
	if (isCached) {
		const sql = 'SELECT * FROM users WHERE username like ?';
		const data = await databaseQuerry(sql, username)
			.catch(() => errorHanlder('Unknown error!', response));
		if (data.length !== 1) {
			return errorHanlder('Username or password is wrong!', response, 401);
		}
		user = data[0];
	}

	bcrypt.compare(password, user.password)
		.then(isSame => {
			if (!isSame) {
				return errorHanlder('Correct username or password!', response, 400);
			}
			isCached ? addCachedUser(user) : resetCacheTimeOf(user);
			request.user = prepareUserToSend(user);
			logger.log(isCached ? 'Auth success' : 'Cached auth success', request.user);
			next();
		})
		.catch(err => errorHanlder(err, response));
};

function hasPerms(...perms) {
	return function (request, response, next) {
		logger.log('Check that', request.user, 'has', perms);

		const permsToCheck = JSON.parse(request.user.permissions).isDefault ? getDefaultPermissions() : JSON.parse(request.user.permissions);
		if (!containsAllPerms(permsToCheck, perms)) {
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

const getAllowedEntityProperties = () =>
	['title', 'comment', 'description', 'rating', 'categoryId', 'price', 'brand', 'percentage', 'contentVolume', 'documentIds'];

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
	fs.rm(path, { recursive: true, force: true }, err => err ? logger.log(err) : null);
};

const isValideSQLTimestamp = stamp => {
	return typeof stamp === 'string' && /([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):([0-5]\d):([0-5]\d))/.test(stamp);
}