import express from 'express';
import { getNews, getTrendingTopics, getNewsImage } from '../controllers/newsController.js';

const router = express.Router();

router.get('/trending', getTrendingTopics);
router.get('/image', getNewsImage);
router.get('/', getNews);

export default router;
