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
import { getAllFoods, getFoodById, addFood, changeFood, deleteFood } from './routes/food';
import { CERT_PEM, KEY_PEM } from './utils/constans';

program
	.addOption(new Option('-d, --dev', 'run in dev').default(false))
	.parse();

const options = program.opts();
const logger = new Logger('Server');
const app = express();

https.createServer({
	key: fs.readFileSync(KEY_PEM),
	cert: fs.readFileSync(CERT_PEM)
}, app)
	.listen(3000, () => logger.log('Server started!'));

app.disable('x-powered-by');

app.use(cors());
app.use(express.json());
app.use(checkAuth);

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

app.get('/food', hasPerms('VIEW_FOOD'), getAllFoods);

app.get('/food/:id', hasPerms('VIEW_FOOD'), getFoodById);

app.post('/food', hasPerms('ADD_FOOD'), addFood);

app.put('/food/:id', hasPerms('CHANGE_FOOD'), changeFood);

app.delete('/food/:id', hasPerms('DELETE_FOOD'), deleteFood);

