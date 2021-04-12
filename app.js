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

program
	.addOption(new Option('-d, --dev', 'run in dev').default(false))
	.parse();

const options = program.opts();
const logger = new Logger('App');
const app = express();

app.use(cors());
app.use(express.json());

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
					logger.warn('To much data in register body!', key)
					delete request.body[key];
				}
			}
			const permissions = getDefaultPermissions();
			request.body.permissions = permissions.length ? JSON.stringify(permissions) : undefined;

			const sqlInsertUser = 'INSERT INTO users set ?';
			databaseQuerry(sqlInsertUser, { ...request.body, password: salt })
				.then(() => response.sendStatus(200))
				.then(() => logger.log('Register success'))
				.catch(() => errorHanlder('Error! Username already taken!', response));
		})
		.catch(() => errorHanlder('Error while creating salt!', response));
});

app.get('/login', checkAuth, (request, response) => {
	logger.log('Login', request.user);
	response.status(200).send(request.user);
});

app.delete('/deleteuser', checkAuth, (request, response) => {
	logger.log('Delete User', request.user);
	const sqlDeleteUser = 'DELETE FROM users WHERE username = ?';
	databaseQuerry(sqlDeleteUser, request.user.username)
		.then(() => deleteCachedUser(request.user.username))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Delete success'))
		.catch(() => errorHanlder('Error! While deleting!', response));
});

app.put('/changepassword', checkAuth, hasPerm(perms.EDIT_PASSWORD), (request, response) => {
	logger.log('Changepassword', request.user);
	if (!request.body?.newPassword) {
		return errorHanlder('Empty newPassword!', response);
	}

	bcrypt.hash(request.body.newPassword, 10)
		.then(salt => {
			const sqlChangePassword = 'UPDATE users SET password = ? WHERE username = ?';
			databaseQuerry(sqlChangePassword, [salt, request.user.username])
				.then(() => updateCachedUser(request.user.username, { ...request.user, password: salt }))
				.then(() => response.sendStatus(200))
				.then(() => logger.log('Change success'))
				.catch(() => errorHanlder('Error while changing password!', response));
		})
		.catch(() => errorHanlder('Error while creating salt!', response));
});

app.put('/changeusername', checkAuth, hasPerm(perms.EDIT_USERNAME), (request, response) => {
	logger.log('Changeusername', request.user, request.body?.newUsername);
	if (!request.body?.newUsername) {
		return errorHanlder('Empty new username!', response);
	}

	const sqlChangeUsername = 'UPDATE users SET username = ? WHERE username = ?';
	databaseQuerry(sqlChangeUsername, [request.body.newUsername, request.user.username])
		.then(() => updateCachedUser(request.user.username, { ...request.user, username: newUsername }))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Change success'))
		.catch(() => errorHanlder('Error while changing username!', response));
});

app.delete('/logout', checkAuth, (request, response) => {
	logger.log('Logout', request.user.username);
	deleteCachedUser(request.user.username);
	response.sendStatus(200);
});

app.get('/getfoods', checkAuth, hasPerm(perms.VIEW_FOOD), (request, response) => {
	logger.log('Getfoods', request.user);

	const sqlGetFoods = 'SELECT * FROM entity';
	databaseQuerry(sqlGetFoods, [])
		.then(data => response.status(200).send(data))
		.then(() => logger.log('Change success'))
		.catch(() => errorHanlder('Error while getting foods!', response));
});

app.post('/addfood', checkAuth, hasPerm(perms.ADD_FOOD), (request, response) => {
	logger.log('Addfood', request.body);
	if (!request.body) {
		return errorHanlder('No food!', response);
	}

	for (const key in request.body) {
		if (!getAllowedEntityProperties().includes(key)) {
			logger.warn('To much data in addFood body!', key)
			delete request.body[key];
		}
	}

	const sqlInsertFood = 'INSERT INTO entity set ?';
	databaseQuerry(sqlInsertFood, request.body)
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Insert success'))
		.catch((err) => errorHanlder(err, response));
});

app.put('/changefood', checkAuth, hasPerm(perms.CHANGE_FOOD), (request, response) => {
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
			logger.warn('To much data in changeFood body!', key)
			delete request.body[key];
		}
	}

	sqlChangeFood = sqlChangeFood.substring(0, sqlChangeFood.length - 2) + ' WHERE entityId = ?';
	databaseQuerry(sqlChangeFood, [...insetValues, idToChange])
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Change success'))
		.catch((err) => errorHanlder(err, response));
});

app.put('/deletefood', checkAuth, hasPerm(perms.DELETE_FOOD), (request, response) => {
	logger.log('Deletefood', request.body);
	if (!request.body?.idToDelete) {
		return errorHanlder('No id to delete!', response);
	}
	// @FIXME delete documents
	const sqlDeleteFood = 'DELETE FROM entity WHERE entityId = ?';
	databaseQuerry(sqlDeleteFood, request.body.idToDelete)
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Delete success'))
		.catch((err) => errorHanlder(err, response));
});

const errorHanlder = (err, response = undefined, status = 500) => {
	logger.error(err);
	if (typeof response?.status === 'function') {
		response.status(status).send(err);
	}
}

function checkAuth(request, response, next) {
	logger.log('Check Auth of', request.headers.authorization);
	if (!request.headers.authorization) {
		return errorHanlder('Authentication required!', response, 400);
	}
	const b64auth = request.headers.authorization.split(' ')[1]
	const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':')
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
}

function hasPerm(...perms) {
	return function (request, response, next) {
		logger.log('Check that', request.user, 'has', perms);

		if (!request.user?.permissions || !containsAll(request.user.permissions, perms)) {
			return errorHanlder('No permissions for this action!', response, 403);
		}
		logger.log('Permcheck success');
		next();
	}
}

const containsAll = (have, mustHave) => {
	have = JSON.parse(have).map(perm => perm.id ?? perm);
	if (have.indexOf(perms.ADMIN) !== -1) {
		return true;
	}
	for (const must of mustHave) {
		if (have.indexOf(must.id) === -1) {
			return false;
		}
		logger.log(must);
	}
	return true;
}

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
}

const getAllowedEntityProperties = () =>
	['title', 'comment', 'description', 'rating', 'categoryId', 'price', 'brand', 'percentage', 'contentVolume', 'ducumentIds']
