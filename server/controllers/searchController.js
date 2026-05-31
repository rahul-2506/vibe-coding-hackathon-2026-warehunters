import { productService } from '../services/productService.js';
import { response } from '../utils/response.js';

export const searchController = {
    async search(req, res, next) {
        try {
            const { q, category, sort } = req.query;
            const products = await productService.searchProducts(q, category, sort);
            return response.success(res, products);
        } catch (err) {
            next(err);
        }
    }
};
