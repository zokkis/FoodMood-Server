const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const mysql = require('mysql');
const { log, error } = require('./logger');
const fs = require('fs');
const https = require('https');
const perms = require('./permissions.json');
const package = require('./package.json');
const { program, Option } = require('commander');

program
	.addOption(new Option('-d, --dev [boo]', 'run in dev').choices([false, true]).default(false))
	.parse();
const options = program.opts();

const db = mysql.createConnection(require('./private_files/sqlConfigs.json'));

db.connect(err => {
	if (err) {
		throw err;
	}
	log('MySQL connected...');
})

const cachedUsers = [];

const app = express();

app.use(cors());
app.use(express.json());

https.createServer({
	key: fs.readFileSync('./private_files/private.pem'),
	cert: fs.readFileSync('./private_files/cert.pem')
}, app)
	.listen(3000, () => log('Server started!'));

app.get('/', (request, response) => {
	log('Root');
	response.status(200).send('<strong>ONLINE</strong>');
});

app.get('/info', (request, response) => {
	log('Info')
	response.status(200).send({ isOnline: true, version: package.version, isDev: options.dev });
});

app.post('/register', (request, response) => {
	log('Register', request.body);
	if (!request.body?.username || !request.body.password) {
		return errorHanlder('Missing username or password!', request);
	}

	bcrypt.hash(request.body.password, 10)
		.then(salt => {
			const sqlInsertUser = 'INSERT INTO users set ?';
			dbQuery(sqlInsertUser, { ...request.body, password: salt })
				.then(() => response.status(200).send())
				.then(() => log('Register success'))
				.catch(() => errorHanlder('Error! Username already taken!', response));
		})
		.catch(() => errorHanlder('Error while creating salt!', response));
});

app.get('/login', checkAuth, (request, response) => {
	log('Login', request.user)
	response.status(200).send(request.user)
		.then(() => log('Login success'));
});

app.put('/changepassword', checkAuth, hasPerm(perms.EDIT_PASSWORD), (request, response) => {
	log('Changepassword', request.user, request.body?.newPassword);
	if (!request.body?.newPassword) {
		return errorHanlder('Empty newPassword!', response);
	}

	bcrypt.hash(request.body.newPassword, 10)
		.then(salt => {
			const sqlChangePassword = 'UPDATE users SET password = ? WHERE username = ?';
			dbQuery(sqlChangePassword, [salt, request.user.username])
				.then(() => response.status(200).send())
				.then(() => log('Change success'))
				.catch(() => errorHanlder('Error while changing password!', response));
		})
		.catch(() => errorHanlder('Error while creating salt!', response));
});

app.put('/changeusername', checkAuth, hasPerm(perms.EDIT_USERNAME), (request, response) => {
	log('Changeusername', request.user, request.body?.newUsername);
	if (!request.body?.newUsername) {
		return errorHanlder('Empty new username!', response);
	}

	const sqlChangeUsername = 'UPDATE users SET username = ? WHERE username = ?';
	dbQuery(sqlChangeUsername, [request.body.newUsername, request.user.username])
		.then(() => response.status(200).send())
		.then(() => log('Change success'))
		.catch(() => errorHanlder('Error while changing username!', response));
});

const dbQuery = (sql, data) => {
	return new Promise((solve, reject) =>
		db.query(sql, data, (err, result) => err ? reject(err) : solve(result)))
}

const errorHanlder = (err, response = undefined, status = 500) => {
	error(err);
	response?.status(status).send(err);
}

function checkAuth(request, response, next) {
	log('Check Auth of'. request.headers.authorization);
	if (!request.headers.authorization) {
		return errorHanlder('Authentication required!', response, 400);
	}
	const b64auth = request.headers.authorization.split(' ')[1]
	const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':')
	if (!username || !password) {
		return errorHanlder('Username or password is missing!', response, 400);
	}

	let user = cachedUsers.find(user => user.username === username);
	const isCached = !!user;
	if(isCached) {
		const sql = 'SELECT * FROM users WHERE username like ?';
		dbQuery(sql, username)
			.then(data => {
				if (data.length !== 1) {
					return errorHanlder('Username or password is wrong!', response, 401);
				}
				user = data[0];
			})
			.catch(() => errorHanlder('Unknown error!', response));
	}

	bcrypt.compare(password, user.password)
		.then(isSame => {
			if (!isSame) {
				return errorHanlder('Correct username or password!', response, 400);
			}
			isCached ? null : cachedUsers.push(user);
			request.user = user;
			request.user.permissions = JSON.parse(request.user.permissions);
			delete request.user.password;
			log(isCached ? 'Cached auth success' : 'Auth success', request.user);
			next();
		})
		.catch(() => errorHanlder('Internal error while compare!', response));
}

function hasPerm(...perms) {
	return hasPerm[perms] || (hasPerm[perms] = function (request, response, next) {
		log('Check that', request.user, 'has', perms);
		if (!request.user?.permissions || !containsAll(request.user.permissions, perms)) {
			return errorHanlder('No permissions for this action!', response, 403);
		}
		log('Permcheck success');
		next();
	})
}

function containsAll(have, mustHave) {
	have = JSON.parse(have).map(perm => perm.id ?? perm);
	for (const must of mustHave) {
		if (have.indexOf(must.id) == -1) {
			return false;
		}
	}
	return true;
}