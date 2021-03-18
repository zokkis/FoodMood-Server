const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const mysql = require('mysql');
const logger = require('./logger');
const fs = require('fs');
const https = require('https');

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
	.listen(3000);

app.get('/', (request, response) => {
	console.log(request.body)
	response.status().status(200).send('<strong>ONLINE</strong>');
});

app.post('/register', checkUserIsNotNull, (request, response) => {
	bcrypt.hash(request.body.password, 10)
		.then(salt => {
			const sqlInsertUser = 'INSERT INTO users set ?';
			dbQuery(sqlInsertUser, { ...request.body, password: salt })
				.then(() => response.status(200).send('User registered!'))
				.catch(() => {
					errorHanlder('Error! Username already taken or to long!', response);
				});
		}).catch(() => errorHanlder('Error while creating salt!', response));
});

app.post('/login', checkUserIsNotNull, (request, response) => {
	const sql = 'SELECT * FROM users WHERE username like ?';
	dbQuery(sql, request.body.username)
		.then(data => {
			if (data.length === 1) {
				bcrypt.compare(request.body.password, data[0].password)
					.then(isSame => {
						if (isSame) {
							delete data['password'];
							response.status(200).send('Hello, ' + request.body.username + ' - Your data: ' + data);
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
});

app.post('/changepassword', checkUserIsNotNull, (request, response) => {
	if (!request.body.newPassword) {
		errorHanlder('Empty new password!', response);
		return;
	}
	const sqlGetUser = 'SELECT * from users where username like ?';
	dbQuery(sqlGetUser, request.body.username)
		.then(data => {
			if (data.length === 1) {
				bcrypt.compare(request.body.password, data[0].password)
					.then(isSame => {
						if (isSame) {
							bcrypt.hash(request.body.newPassword, 10)
								.then(salt => {
									const sqlChangePassword = 'UPDATE users SET password = ? WHERE username = ?';
									dbQuery(sqlChangePassword, [salt, request.body.username])
										.then(() => response.status(200).send('Password changed!'))
										.catch(() => {
											errorHanlder('Error while changing password!', response);
										});
								}).catch(() => errorHanlder('Error while creating salt!', response));
						} else {
							errorHanlder('Correct username or password!', response);
						}
					})
					.catch(() => errorHanlder('Internal error while compare!', response));
			} else {
				errorHanlder('Username or password is wrong!', response);
			}
		})
		.catch(() => {
			errorHanlder('Error while getting user!', response);
		});
});

app.post('/changeusername', checkUserIsNotNull, (request, response) => {
	if (!request.body.newUsername) {
		errorHanlder('Empty new username!', response);
		return;
	}
	const sqlGetUser = 'SELECT * from users where username like ?';
	dbQuery(sqlGetUser, request.body.username)
		.then(data => {
			if (data.length === 1) {
				bcrypt.compare(request.body.password, data[0].password)
					.then(isSame => {
						if (isSame) {
							const sqlChangeUsername = 'UPDATE users SET username = ? WHERE username = ?';
							dbQuery(sqlChangeUsername, [request.body.newUsername, request.body.username])
								.then(() => response.status(200).send('Username changed!'))
								.catch(() => {
									errorHanlder('Error while changing username!', response);
								});
						} else {
							errorHanlder('Correct username or password!', response);
						}
					})
					.catch(() => errorHanlder('Internal error while compare!', response));
			} else {
				errorHanlder('Username or password is wrong!', response);
			}
		})
		.catch(() => {
			errorHanlder('Error while getting user!', response);
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

function checkUserIsNotNull(request, response, next) {
	if (!request.body?.password && !request.body?.username) {
		errorHanlder('Username or password is missing!', response, 401);
		return;
	}
	next();
}