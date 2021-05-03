import express from 'express';
import cors from 'cors';
import https from 'https';
import fs from 'fs';
import { program, Option } from 'commander';
import Logger from './utils/logger';
import { addFavorite, addShoppingList, changePassword, changeUsername, deleteFavorite, deleteShoppingList, deleteUser, getFavorites, getUsers, login, logout, register } from './routes/user';
import { hasPerms } from './utils/permissions';
import { checkAuth } from './utils/auth';
import server from '../package.json';
import { getAllFoods, getFoodById, addFood, changeFood, deleteFood } from './routes/food';
import { CERT_PEM_PATH, KEY_PEM_PATH, LOG_PATH } from './utils/constans';
import morgan from 'morgan';
import multer from 'multer';
import { checkFileAndMimetype, multerStorage } from './utils/document';
import { addDocument, sendDocument, deleteDocument } from './routes/document';
import { addCategory, changeCategory, deleteCategory, getCategories } from './routes/category';

program
	.addOption(new Option('-d, --dev', 'run in dev').default(false))
	.parse();

const options = program.opts();
const logger = new Logger('Server');
const app = express();

https.createServer({
	key: fs.readFileSync(KEY_PEM_PATH),
	cert: fs.readFileSync(CERT_PEM_PATH)
}, app)
	.listen(3000, () => logger.log('Server started!'));

app.disable('x-powered-by');

app.use(morgan('[:date[iso]] :remote-addr :remote-user :method :url :response-time ms',
	{ stream: fs.createWriteStream(LOG_PATH + '/morgan.log', { flags: 'a' }) }));
app.use(cors());
app.use(express.json());
app.use(checkAuth);

app.get('/', (_request, response) => {
	response.status(200).send('<strong>ONLINE</strong>');
});

const info = { isOnline: true, version: server.version, isDev: options.dev };
app.get('/info', (_request, response) => {
	response.status(200).send(info);
});

app.post('/register', register);

app.get('/login', login);

app.put('/changepassword', hasPerms('EDIT_PASSWORD'), changePassword);

app.put('/changeusername', hasPerms('EDIT_USERNAME'), changeUsername);

app.delete('/logout', logout);

app.delete('/user', deleteUser);

app.get('/user', hasPerms('VIEW_USERS'), getUsers);

app.get('/favorite/:id', hasPerms('VIEW_USERS', 'VIEW_USERS_FAVORITES'), getFavorites);

app.post('/favorite', addFavorite);

app.delete('/favorite/:id', deleteFavorite);

app.post('/shoppinglist', addShoppingList);

app.delete('/shoppinglist/:id', deleteShoppingList);

app.get('/food', hasPerms('VIEW_FOOD'), getAllFoods);

app.get('/food/:id', hasPerms('VIEW_FOOD'), getFoodById);

app.post('/food', hasPerms('ADD_FOOD'), addFood);

app.put('/food/:id', hasPerms('CHANGE_FOOD'), changeFood);

app.delete('/food/:id', hasPerms('DELETE_FOOD'), deleteFood);

app.post('/image',
	hasPerms('ADD_IMAGES'),
	multer({ fileFilter: checkFileAndMimetype('image'), storage: multerStorage }).any(),
	addDocument
);

app.get('/image/:id', hasPerms('VIEW_IMAGES'), sendDocument);

app.delete('/image/:id', hasPerms('DELETE_IMAGES'), deleteDocument);

app.post('/video',
	hasPerms('ADD_VIDEOS'),
	multer({ fileFilter: checkFileAndMimetype('video'), storage: multerStorage }).any(),
	addDocument
);

app.get('/video/:id', hasPerms('VIEW_VIDEOS'), sendDocument);

app.delete('/video/:id', hasPerms('DELETE_VIDEOS'), deleteDocument);

app.get('/category', hasPerms('VIEW_CATEGORIES'), getCategories);

app.post('/category', hasPerms('CREATE_CATEGORY'), addCategory);

app.put('/category/:id', hasPerms('EDIT_CATEGORY'), changeCategory);

app.delete('/category/id:', deleteCategory);