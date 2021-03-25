const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const mysql = require('mysql');
const Logger = require('./logger');
const fs = require('fs');
const https = require('https');
const perms = require('./permissions.json');
const package = require('./package.json');
const { program, Option } = require('commander');
const { addCachedUser, resetCacheTimeOf, getCachedUsers, prepareUserToSend, deleteCachedUser, getAllowedProperties, updateCachedUser } = require('./users');

program
	.addOption(new Option('-d, --dev', 'run in dev').default(false))
	.parse();
const options = program.opts();

const logger = new Logger('App');

const db = mysql.createConnection(require('./private_files/sqlConfigs.json'));

db.connect(err => {
	if (err) {
		throw err;
	}
	logger.log('MySQL connected...');
});

const app = express();

app.use(cors());
app.use(express.json());

https.createServer({
	key: fs.readFileSync('./private_files/private.pem'),
	cert: fs.readFileSync('./private_files/cert.pem')
}, app)
	.listen(3000, () => logger.log('Server started!'));

app.get('/', (request, response) => {
	logger.log('Root');
	response.status(200).send('<strong>ONLINE</strong>');
});

app.get('/info', (request, response) => {
	logger.log('Info')
	response.status(200).send({ isOnline: true, version: package.version, isDev: options.dev });
});

app.post('/register', (request, response) => {
	logger.log('Register', request.body);
	if (!request.body?.username || !request.body.password) {
		return errorHanlder('Missing username or password!', request);
	}

	bcrypt.hash(request.body.password, 10)
		.then(salt => {
			for (const a in request.body) {
				if (!getAllowedProperties().includes(a)) {
					logger.warn('To much data in register body!', a)
					delete request.body[a];
				}
			}

			const sqlInsertUser = 'INSERT INTO users set ?';
			dbQuery(sqlInsertUser, { ...request.body, password: salt })
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
	dbQuery(sqlDeleteUser, request.user.username)
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
			dbQuery(sqlChangePassword, [salt, request.user.username])
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
	dbQuery(sqlChangeUsername, [request.body.newUsername, request.user.username])
		.then(() => updateCachedUser(request.user.username, { ...request.user, username: newUsername }))
		.then(() => response.sendStatus(200))
		.then(() => logger.log('Change success'))
		.catch(() => errorHanlder('Error while changing username!', response));
});

app.delete('/logout', checkAuth, (request, response) => {
	logger.log('Logout', request.user.username);
	deleteCachedUser(request.user.username);
	response.sendStatus(200);
})

const dbQuery = (sql, data) => {
	return new Promise((solve, reject) =>
		db.query(sql, data, (err, result) => err ? reject(err) : solve(result)))
}

const errorHanlder = (err, response = undefined, status = 500) => {
	logger.error(err);
	response?.status(status).send(err);
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

async function checkAuthOf(username, password, request, response, next) {
	let user = getCachedUsers().find(user => user.username === username);
	const isCached = !user;
	if (isCached) {
		const sql = 'SELECT * FROM users WHERE username like ?';
		const data = await dbQuery(sql, username)
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
	return hasPerm[perms] || (hasPerm[perms] = function (request, response, next) {
		logger.log('Check that', request.user, 'has', perms);
		if (!request.user?.permissions || !containsAll(request.user.permissions, perms)) {
			return errorHanlder('No permissions for this action!', response, 403);
		}
		logger.log('Permcheck success');
		next();
	})
}

function containsAll(have, mustHave) {
	have = JSON.parse(have).map(perm => perm.id ?? perm);
	for (const must of mustHave) {
		console.log(must)
		if (have.indexOf(must.id) == -1) {
			return false;
		}
	}
	return true;
}