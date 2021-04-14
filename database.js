const Logger = require('./logger');
const mysql = require('mysql');

const functions = {};
const logger = new Logger('Database');
const db = mysql.createConnection(require('./private_files/sqlConfigs.json'));

db.connect(err => {
	if (err) {
		throw err;
	}
	logger.log('MySQL connected...');
});

functions.databaseQuerry = (sql, data = undefined) => {
	return new Promise((resolve, reject) =>
		db.query(sql, data, (err, result) => err ? reject(err) : resolve(result)))
}

module.exports = functions;