import express from 'express';
import { productController } from '../controllers/productController.js';

const router = express.Router();

// Define specific routes first to prevent conflicts with wildcard parameter route (/:id)
router.get('/search', productController.search);
router.get('/getProducts', productController.getAll);
router.get('/category/:name', productController.getByCategory);
router.post('/import', productController.import);
router.post('/compare', productController.compare);
router.post('/events', productController.logEvent);
router.get('/preferences', productController.getPreferences);
router.post('/preferences', productController.updatePreferences);
router.post('/:id/re-embed', productController.reembed);

// Wildcard routes
router.get('/', productController.getAll);
router.get('/:id', productController.getById);
router.delete('/:id', productController.delete);
router.get('/:id/reviews', productController.getReviews);

export default router;
