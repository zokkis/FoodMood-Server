import express from 'express';
import cors from 'cors';
import https from 'https';
import fs from 'fs';
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
import { addDocument, getDocument, deleteDocument } from './routes/document';
import { addCategory, changeCategory, deleteCategory, getCategories } from './routes/category';
import { getMessagesForMe, getOwnMessages, sendMessage, editMessage, deleteMessage } from './routes/message';
import { checkFoodIds } from './routes/utils';

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

app.get('/', (_request, response) => {
	response.status(200).send('<strong>ONLINE</strong>');
});

const info = { isOnline: true, version: server.version, isProd: process.env.NODE_ENV === 'production' };
app.get('/info', (_request, response) => {
	response.status(200).send(info);
});

app.post('/register', register);

app.get('/login', checkAuth, login);

app.put('/changepassword', checkAuth, hasPerms('EDIT_PASSWORD'), changePassword);

app.put('/changeusername', checkAuth, hasPerms('EDIT_USERNAME'), changeUsername);

app.delete('/logout', checkAuth, logout);

app.delete('/users', checkAuth, deleteUser);

app.get('/users', checkAuth, hasPerms('VIEW_USERS'), getUsers);

app.get('/favorites/:id', checkAuth, hasPerms('VIEW_USERS', 'VIEW_USERS_FAVORITES'), getFavorites);

app.post('/favorites', checkAuth, addFavorite);

app.delete('/favorites/:id', checkAuth, deleteFavorite);

app.post('/shoppinglists', checkAuth, addShoppingList);

app.delete('/shoppinglists/:id', checkAuth, deleteShoppingList);

app.get('/foods', hasPerms('VIEW_FOOD'), checkAuth, getAllFoods);

app.get('/foods/:id', hasPerms('VIEW_FOOD'), checkAuth, getFoodById);

app.post('/foods', hasPerms('ADD_FOOD'), checkAuth, addFood);

app.put('/foods/:id', hasPerms('CHANGE_FOOD'), checkAuth, changeFood);

app.delete('/foods/:id', hasPerms('DELETE_FOOD'), checkAuth, deleteFood);

app.post('/images',
	checkAuth,
	hasPerms('ADD_IMAGES'),
	multer({ fileFilter: checkFileAndMimetype('image'), storage: multerStorage }).any(),
	addDocument
);

app.get('/images/:id', checkAuth, hasPerms('VIEW_IMAGES'), getDocument);

app.delete('/images/:id', checkAuth, hasPerms('DELETE_IMAGES'), deleteDocument);

app.post('/videos',
	checkAuth,
	hasPerms('ADD_VIDEOS'),
	multer({ fileFilter: checkFileAndMimetype('video'), storage: multerStorage }).any(),
	addDocument
);

app.get('/videos/:id', checkAuth, hasPerms('VIEW_VIDEOS'), getDocument);

app.delete('/videos/:id', checkAuth, hasPerms('DELETE_VIDEOS'), deleteDocument);

app.get('/categories', checkAuth, hasPerms('VIEW_CATEGORIES'), getCategories);

app.post('/categories', checkAuth, hasPerms('CREATE_CATEGORY'), addCategory);

app.put('/categories/:id', checkAuth, hasPerms('EDIT_CATEGORY'), changeCategory);

app.delete('/categories/id:', checkAuth, deleteCategory);

app.get('/mymessages', checkAuth, hasPerms('SEND_MESSAGES'), getOwnMessages);

app.get('/messages', checkAuth, getMessagesForMe);

app.post('/messages', checkAuth, hasPerms('SEND_MESSAGES'), sendMessage);

app.put('/messages/:id', checkAuth, hasPerms('EDIT_MESSAGES'), editMessage);

app.delete('/messages/:id', checkAuth, hasPerms('DELETE_MESSAGES'), deleteMessage);

app.post('/utils/foods', checkAuth, hasPerms('VIEW_FOOD'), checkFoodIds);

app.all('*', (_request, response) => {
	response.status(301).redirect('/');
});