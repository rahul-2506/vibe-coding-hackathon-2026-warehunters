import express from 'express';
import { recommendController } from '../controllers/recommendController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:productId', recommendController.getRecommendations);
router.post('/', authMiddleware, recommendController.getAIRecommendations);

export default router;
