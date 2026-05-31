import express from 'express';
import { feedbackController } from '../controllers/feedbackController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { reviewLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/submit', authMiddleware, reviewLimiter, feedbackController.submit);
router.get('/', feedbackController.getAll);
router.get('/user/:userId', authMiddleware, feedbackController.getByUser);

export default router;
