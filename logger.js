module.exports = class Logger {
	constructor(prefix) {
		this.prefix = prefix;
	}

	log(...message) {
		console.log(this.#getLoggingPrefix('LOG'), ...message);
	};

	warn(...warn) {
		console.warn(this.#getLoggingPrefix('WARN'), ...warn);
	};

	error(...error) {
		console.error(this.#getLoggingPrefix('ERROR'), ...error);
	};

	#getLoggingPrefix(loggingType) {
		const date = new Date();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');
		const milliSeconds = String(date.getMilliseconds()).padStart(3, '0');
		return `[${date.getFullYear()}/${month}/${day}, ${hours}:${minutes}:${seconds}.${milliSeconds}] [${this.prefix}] [${loggingType}]`;
	}
}