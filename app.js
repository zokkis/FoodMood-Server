const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const mysql = require('mysql');
const logger = require('./logger');
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
	logger.log('MySQL connected...');
})

const app = express();

app.use(cors());
app.use(express.json());

https.createServer({
	key: fs.readFileSync('./private_files/private.pem'),
	cert: fs.readFileSync('./private_files/cert.pem')
}, app)
	.listen(3000, () => logger.log('Server started!'));

app.get('/', (request, response) => {
	response.status().status(200).send('<strong>ONLINE</strong>');
});

app.get('/info', (request, response) => {
	response.status().status(200).send({ isOnline: true, version: package.version, isDev: options.dev });
});

app.post('/register', (request, response) => {
	if (!request.body?.username || !request.body.password) {
		return errorHanlder('Missing username or password!', request);
	}

	bcrypt.hash(request.body.password, 10)
		.then(salt => {
			const sqlInsertUser = 'INSERT INTO users set ?';
			dbQuery(sqlInsertUser, { ...request.body, password: salt })
				.then(() => response.status(200).send())
				.catch(() => {
					errorHanlder('Error! Username already taken!', response);
				});
		})
		.catch(() => errorHanlder('Error while creating salt!', response));
});

app.get('/login', checkAuth, (request, response) => {
	response.status(200).send(request.user);
});

app.put('/changepassword', checkAuth, hasPerm(perms.EDIT_PASSWORD), (request, response) => {
	if (!request.body.newPassword) {
		return errorHanlder('Empty newPassword!', response);
	}

	bcrypt.hash(request.body.newPassword, 10)
		.then(salt => {
			const sqlChangePassword = 'UPDATE users SET password = ? WHERE username = ?';
			dbQuery(sqlChangePassword, [salt, request.user.username])
				.then(() => response.status(200).send())
				.catch(() => {
					errorHanlder('Error while changing password!', response);
				});
		})
		.catch(() => errorHanlder('Error while creating salt!', response));
});

app.put('/changeusername', checkAuth, hasPerm(perms.EDIT_USERNAME), (request, response) => {
	if (!request.body.newUsername) {
		return errorHanlder('Empty new username!', response);
	}

	const sqlChangeUsername = 'UPDATE users SET username = ? WHERE username = ?';
	dbQuery(sqlChangeUsername, [request.body.newUsername, request.user.username])
		.then(() => response.status(200).send())
		.catch(() => {
			errorHanlder('Error while changing username!', response);
		});
});

const dbQuery = (sql, data) => {
	return new Promise((solve, reject) =>
		db.query(sql, data, (err, result) => err ? reject(err) : solve(result)))
}

const errorHanlder = (err, response = undefined, status = 500) => {
	logger.error(err);
	response?.status(status).send(err);
}

function checkAuth(request, response, next) {
	if (!request.headers.authorization) {
		return errorHanlder('Authentication required!', response, 401);
	}
	const b64auth = request.headers.authorization.split(' ')[1]
	const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':')
	if (username && password) {
		const sql = 'SELECT * FROM users WHERE username like ?';
		dbQuery(sql, username)
			.then(data => {
				if (data.length === 1) {
					bcrypt.compare(password, data[0].password)
						.then(isSame => {
							if (isSame) {
								request.user = data[0];
								request.user.permissions = JSON.parse(request.user.permissions);
								delete request.user.password;
								next();
							} else {
								errorHanlder('Correct username or password!', response);
							}
						})
						.catch(() => errorHanlder('Internal error while compare!', response));
				} else {
					errorHanlder('Username or password is wrong!', response);
				}
			})
			.catch(() => errorHanlder('Unknown error!', response));
	} else {
		return errorHanlder('Username or password is missing!', response, 401);
	}
}

function hasPerm(...perm) {
	return hasPerm[perm] || (hasPerm[perm] = function (request, response, next) {
		if (!request.user?.permissions || !containsAll(request.user.permissions, perm)) {
			return errorHanlder('No permissions for this action!', response);
		}
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