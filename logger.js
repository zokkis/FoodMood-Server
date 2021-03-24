functions = {};

functions.log = (...message) => {
	console.log(getLoggingPrefix('LOG'), ...message);
};

functions.warn = (...warn) => {
	console.warn(getLoggingPrefix('WARN'), ...warn);
};

functions.error = (...error) => {
	console.error(getLoggingPrefix('ERROR'), ...error);
};

const getLoggingPrefix = (loggingType) => {
	const date = new Date();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');
	const milliSeconds = String(date.getMilliseconds()).padStart(3, '0');
	return `[${date.getFullYear()}/${month}/${day}, ${hours}:${minutes}:${seconds}.${milliSeconds}] [${loggingType}]`;
}

module.exports = functions;