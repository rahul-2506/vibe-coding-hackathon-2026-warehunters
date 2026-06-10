import express from 'express';
import { recommendController } from '../controllers/recommendController.js';
import { optionalAuthMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:productId', recommendController.getRecommendations);
router.post('/', optionalAuthMiddleware, recommendController.getAIRecommendations);

export default router;
