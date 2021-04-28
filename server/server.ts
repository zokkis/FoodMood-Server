import express from 'express';
import cors from 'cors';
import https from 'https';
import fs from 'fs';
import { program, Option } from 'commander';
import Logger from './utils/logger';
import { changePassword, changeUsername, deleteUser, login, logout, register } from './routes/user';
import { hasPerms } from './utils/permissions';
import { checkAuth } from './utils/auth';
import server from '../package.json';

program
	.addOption(new Option('-d, --dev', 'run in dev').default(false))
	.parse();

const options = program.opts();
const logger = new Logger('Server');
const app = express();

app.use(cors());
app.use(express.json());
app.use(checkAuth);

app.disable('x-powered-by');

https.createServer({
	key: fs.readFileSync('./private_files/private.pem'),
	cert: fs.readFileSync('./private_files/cert.pem')
}, app)
	.listen(3000, () => logger.log('Server started!'));

app.get('/', (request, response) => {
	logger.log('Root', request.ip);
	response.status(200).send('<strong>ONLINE</strong>');
});

const info = { isOnline: true, version: server.version, isDev: options.dev };
app.get('/info', (request, response) => {
	logger.log('Info', request.ip);
	response.status(200).send(info);
});

app.post('/register', register);

app.get('/login', login);

app.put('/changepassword', hasPerms('EDIT_PASSWORD'), changePassword);

app.put('/changeusername', hasPerms('EDIT_USERNAME'), changeUsername);

app.delete('/logout', logout);

app.delete('/user', deleteUser);

