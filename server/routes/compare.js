import express from 'express';
import { compareController } from '../controllers/compareController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/analyze', authMiddleware, compareController.analyze);
router.post('/save', authMiddleware, compareController.save);
router.get('/history/:userId', compareController.getHistory);
router.get('/saved/:userId', compareController.getSaved);

export default router;
