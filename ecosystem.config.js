module.exports = {
	apps: [{
		name: 'server',
		script: './dist/server/server.js',
		env: {
			NODE_ENV: 'development',
		},
		// eslint-disable-next-line @typescript-eslint/naming-convention
		env_production: {
			NODE_ENV: 'production',
		}
	}]
};
