import express from 'express';
import { compareController } from '../controllers/compareController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

router.post('/analyze', authMiddleware, validate.compare, compareController.analyze);
router.post('/save', authMiddleware, compareController.save);
router.get('/history/:userId', authMiddleware, compareController.getHistory);
router.get('/saved/:userId', authMiddleware, compareController.getSaved);

export default router;
