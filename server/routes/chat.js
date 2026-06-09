import express from 'express';
import { vchatController } from '../controllers/vchatController.js';
import { optionalAuthMiddleware } from '../middleware/authMiddleware.js';
import { chatLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

router.post('/', optionalAuthMiddleware, chatLimiter, validate.chat, vchatController.chat);
router.post('/stream', optionalAuthMiddleware, chatLimiter, validate.chat, vchatController.stream);

export default router;
