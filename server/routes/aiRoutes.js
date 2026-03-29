import express from 'express';
import { getSummary, chatWithNews, createNewsImage } from '../controllers/aiController.js';

const router = express.Router();

router.post('/summary', getSummary);
router.post('/chat', chatWithNews);
router.post('/image', createNewsImage);

export default router;
