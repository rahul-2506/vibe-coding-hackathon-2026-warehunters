import express from 'express';
import { aiController } from '../controllers/aiController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/compare', authMiddleware, aiController.compare);
router.post('/scrape-price', aiController.scrapePrice);
router.post('/generate-fake', authMiddleware, aiController.generateFake);
router.post('/predict', authMiddleware, aiController.predict);

export default router;
