import { recommendationService } from '../services/recommendationService.js';
import { response } from '../utils/response.js';

export const recommendController = {
    async getRecommendations(req, res, next) {
        try {
            const rawId = req.params.productId;
            const productId = Number(rawId);
            
            // Allow stringified 'undefined' to fetch ML service popular recommendations fallback
            if (isNaN(productId) && rawId !== 'undefined') {
                return response.error(res, 'Product ID must be a valid number', null, 400);
            }

            const paramId = isNaN(productId) ? 'undefined' : productId;
            const recommendations = await recommendationService.getRecommendations(paramId);
            return response.success(res, recommendations);
        } catch (err) {
            if (err.message === 'Target product not found.') {
                return response.error(res, err.message, null, 404);
            }
            next(err);
        }
    },

    async getAIRecommendations(req, res, next) {
        try {
            const { prompt } = req.body;
            if (!prompt) {
                return response.error(res, 'Prompt is required', null, 400);
            }

            const recommendations = await recommendationService.getAIRecommendations(prompt);
            return response.success(res, {
                success: true,
                data: recommendations,
                recommendations: recommendations
            });
        } catch (err) {
            next(err);
        }
    }
};
