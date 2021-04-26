const fs = require('fs');

if (!fs.existsSync('./logs')) {
	fs.mkdirSync('./logs');
}
const logStream = fs.createWriteStream("./logs/logs.log", { flags: 'a+' });
const warnStream = fs.createWriteStream("./logs/warns.log", { flags: 'a+' });
const errorStream = fs.createWriteStream("./logs/erros.log", { flags: 'a+' });

module.exports = class Logger {
	constructor(prefix) {
		this.prefix = prefix;
	}

	log(...message) {
		const prefix = this.#getLoggingPrefix('\x1b[37m', 'LOG');
		console.log(prefix, ...message, '\x1b[0m');
		this.#appendTo(logStream, prefix, message);
	};

	warn(...warn) {
		const prefix = this.#getLoggingPrefix('\x1b[33m', 'WARN');
		console.warn(prefix, ...warn, '\x1b[0m');
		this.#appendTo(warnStream, prefix, warn);
	};

	error(...error) {
		const prefix = this.#getLoggingPrefix('\x1b[31m', 'ERROR');
		console.error(prefix, ...error, '\x1b[0m');
		this.#appendTo(errorStream, prefix, error);
	};

	#getLoggingPrefix(color, loggingType) {
		const date = new Date();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');
		const milliSeconds = String(date.getMilliseconds()).padStart(3, '0');
		return `${color}[${date.getFullYear()}/${month}/${day}, ${hours}:${minutes}:${seconds}.${milliSeconds}] [${this.prefix}] [${loggingType}]`;
	}

	#appendTo(stream, prefix, arr) {
		stream.write('\n' + prefix);
		arr.forEach(a => {
			const toWrite = typeof a !== 'object' ? a : JSON.stringify(a);
			stream.write(' ' + toWrite);
		});
	}
}