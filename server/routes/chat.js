import express from 'express';
import { vchatController } from '../controllers/vchatController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { chatLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/', authMiddleware, chatLimiter, vchatController.chat);

export default router;
