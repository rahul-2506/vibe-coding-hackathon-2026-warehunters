import { aiService } from '../services/aiService.js';
import { response } from '../utils/response.js';

export const aiController = {
    async compare(req, res, next) {
        try {
            const { product1, product2 } = req.body;
            if (!product1 || !product2) {
                return response.error(res, 'Two products are required for comparison', null, 400);
            }

            const data = await aiService.compareProducts(product1, product2);
            return response.success(res, data);
        } catch (err) {
            next(err);
        }
    },

    async scrapePrice(req, res, next) {
        try {
            const { product_name } = req.body;
            if (!product_name) {
                return response.error(res, 'Product name is required', null, 400);
            }

            const data = await aiService.scrapePrice(product_name);
            return response.success(res, data);
        } catch (err) {
            next(err);
        }
    },

    async generateFake(req, res, next) {
        try {
            const { product_id, product_name, tone } = req.body;
            if (!product_id || !product_name || !tone) {
                return response.error(res, 'Product ID, product name, and tone are required', null, 400);
            }
            const data = await aiService.generateFake(product_id, product_name, tone);
            return response.success(res, data);
        } catch (err) {
            next(err);
        }
    },

    async predict(req, res, next) {
        try {
            const { review } = req.body;
            if (!review) {
                return response.error(res, 'Review text is required', null, 400);
            }
            const data = await aiService.predict(review);
            return response.success(res, data);
        } catch (err) {
            next(err);
        }
    }
};
