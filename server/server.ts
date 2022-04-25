import compression from 'compression';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import https from 'https';
import http from 'http';
import morgan from 'morgan';
import multer from 'multer';
import server from '../package.json';
import { defaultHttpResponseMessages } from './models/httpResponse';
import { addCategory, changeCategory, deleteCategory, getCategory, getCategories } from './routes/category';
import { addDocument, deleteDocument, getDocument } from './routes/document';
import { addFood, changeFood, deleteFood, getAllFoods, getFoodById, rateFood } from './routes/food';
import { deleteMessage, editMessage, getMessagesForMe, getOwnMessages, sendMessage } from './routes/message';
import {
	addFavorite,
	addShoppingList,
	changePassword,
	changeUsername,
	deleteFavorite,
	deleteShoppingList,
	deleteUser,
	getFavorites,
	getUsers,
	login,
	logout,
	register,
} from './routes/user';
import { checkFoodIds } from './routes/utils';
import { checkAuth } from './utils/auth';
import { CERT_PEM_PATH, isProd, KEY_PEM_PATH, LOG_PATH } from './utils/constans';
import { checkFileAndMimetype, multerStorage } from './utils/document';
import { mkdirIfNotExist } from './utils/fileAndFolder';
import Logger from './utils/logger';
import { hasPerms } from './utils/permissions';

const logger = new Logger('Server');
const app = express();

const PORT = process.env.PORT || 3000;

if (process.env.HTTPS) {
	https
		.createServer(
			{
				key: fs.readFileSync(KEY_PEM_PATH),
				cert: fs.readFileSync(CERT_PEM_PATH),
			},
			app
		)
		.listen(PORT, () => logger.log('HTTPS-Server started on port ' + PORT + '!'));
} else {
	http.createServer({}, app).listen(PORT, () => logger.log('HTTP-Server started on port ' + PORT + '!'));
}

app.disable('x-powered-by');

mkdirIfNotExist(LOG_PATH, () => {
	app.use(
		morgan('[:date[iso]] :remote-addr :remote-user :method :url :response-time ms', {
			stream: fs.createWriteStream(LOG_PATH + '/morgan.log', { flags: 'a' }),
		})
	);
});

app.use(cors());
app.use(express.json());
app.use(compression());

app.use('/favicon.ico', express.static('images/favicon.ico'));

app.get('/', (_request, response) => {
	response.status(200).json('ONLINE');
});

const info = { isOnline: true, version: server.version, isProd };
app.get('/info', (_request, response) => {
	response.status(200).json(info);
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

app.get('/foods', checkAuth, hasPerms('VIEW_FOOD'), getAllFoods);

app.get('/foods/:id', checkAuth, hasPerms('VIEW_FOOD'), getFoodById);

app.post('/foods', checkAuth, hasPerms('ADD_FOOD'), addFood);

app.put('/foods/:id', checkAuth, hasPerms('CHANGE_FOOD'), changeFood);

app.delete('/foods/:id', checkAuth, hasPerms('DELETE_FOOD'), deleteFood);

app.post('/foods/:id/rating', checkAuth, hasPerms('RATE_FOOD'), rateFood);

app.put('/foods/:id/rating', checkAuth, hasPerms('RATE_FOOD'), rateFood);

app.post(
	'/images',
	checkAuth,
	hasPerms('ADD_IMAGES'),
	multer({ fileFilter: checkFileAndMimetype('image'), storage: multerStorage }).any(),
	addDocument
);

app.get('/images/:id', checkAuth, hasPerms('VIEW_IMAGES'), getDocument);

app.delete('/images/:id', checkAuth, hasPerms('DELETE_IMAGES'), deleteDocument);

app.post(
	'/videos',
	checkAuth,
	hasPerms('ADD_VIDEOS'),
	multer({ fileFilter: checkFileAndMimetype('video'), storage: multerStorage }).any(),
	addDocument
);

app.get('/videos/:id', checkAuth, hasPerms('VIEW_VIDEOS'), getDocument);

app.delete('/videos/:id', checkAuth, hasPerms('DELETE_VIDEOS'), deleteDocument);

app.get('/categories', checkAuth, hasPerms('VIEW_CATEGORIES'), getCategories);

app.get('/categories/:id', checkAuth, hasPerms('VIEW_CATEGORIES'), getCategory);

app.post('/categories', checkAuth, hasPerms('CREATE_CATEGORY'), addCategory);

app.put('/categories/:id', checkAuth, hasPerms('EDIT_CATEGORY'), changeCategory);

app.delete('/categories/:id', checkAuth, deleteCategory);

app.get('/mymessages', checkAuth, hasPerms('SEND_MESSAGES'), getOwnMessages);

app.get('/messages', checkAuth, getMessagesForMe);

app.post('/messages', checkAuth, hasPerms('SEND_MESSAGES'), sendMessage);

app.put('/messages/:id', checkAuth, hasPerms('EDIT_MESSAGES'), editMessage);

app.delete('/messages/:id', checkAuth, hasPerms('DELETE_MESSAGES'), deleteMessage);

app.post('/utils/foods', checkAuth, hasPerms('VIEW_FOOD'), checkFoodIds);

app.all('*', (_request, response) => {
	response.status(404).json(defaultHttpResponseMessages.get(404));
});
