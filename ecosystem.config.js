module.exports = {
	apps: [
		{
			name: 'FoodMood',
			script: './dist/server/server.js',
			env: {
				NODE_ENV: 'development',
				PORT: 8080,
			},
			// eslint-disable-next-line @typescript-eslint/naming-convention
			env_production: {
				NODE_ENV: 'production',
				PORT: 8080,
			},
		},
	],
};
