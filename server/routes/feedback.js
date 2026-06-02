import express from 'express';
import { feedbackController } from '../controllers/feedbackController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { reviewLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

router.post('/submit', authMiddleware, reviewLimiter, validate.review, feedbackController.submit);
router.get('/', feedbackController.getAll);
router.get('/user/:userId', authMiddleware, feedbackController.getByUser);

export default router;
