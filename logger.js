module.exports = class Logger {
	constructor(prefix) {
		this.prefix = prefix;
	}

	log(...message) {
		console.log(this.#getLoggingPrefix('\x1b[37m', 'LOG'), ...message, '\x1b[0m');
	};

	warn(...warn) {
		console.warn(this.#getLoggingPrefix('\x1b[33m', 'WARN'), ...warn, '\x1b[0m');
	};

	error(...error) {
		console.error(this.#getLoggingPrefix('\x1b[31m', 'ERROR'), ...error, '\x1b[0m');
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
}