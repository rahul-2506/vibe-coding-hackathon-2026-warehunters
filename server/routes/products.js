import express from 'express';
import { productController } from '../controllers/productController.js';

const router = express.Router();

router.get('/getProducts', productController.getAll);
router.get('/', productController.getAll);
router.get('/:id', productController.getById);
router.get('/category/:name', productController.getByCategory);
router.get('/:id/reviews', productController.getReviews);

export default router;
