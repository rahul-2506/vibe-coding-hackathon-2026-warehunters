import express from 'express';
import { searchController } from '../controllers/searchController.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

router.get('/', validate.search, searchController.search);

export default router;
