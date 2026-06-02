import { supabase } from '../db.js';
import { aiGateway } from '../services/gateway/aiGateway.js';
import { logger } from '../utils/logger.js';
import { response } from '../utils/response.js';
import { productService } from '../services/productService.js';

export const compareController = {
    /**
     * Executes the advanced review-scoring, NLP analysis, and custom preferences matching pipeline.
     */
    async analyze(req, res, next) {
        try {
            const { product1Id, product2Id, preferences } = req.body;
            const userId = req.user?.id;

            if (!product1Id || !product2Id) {
                return response.error(res, 'Two product IDs are required for analysis.', null, 400);
            }

            logger.info(`[COMPARISON CONTROLLER] Loading product details for IDs: ${product1Id} and ${product2Id}`, 'COMPARE');

            // 1. Fetch full product objects using resilient productService catalog
            const p1 = await productService.getProductById(product1Id);
            const p2 = await productService.getProductById(product2Id);

            if (!p1 || !p2) {
                logger.error(`[COMPARISON CONTROLLER] Failed to find compared products for IDs: ${product1Id}, ${product2Id}`, 'COMPARE');
                return response.error(res, 'Failed to fetch compared products from inventory.', null, 404);
            }

            // 2. Call the centralized AI Gateway comparison service
            logger.info('[COMPARISON CONTROLLER] Dispatching products to AI Gateway comparison service...', 'COMPARE');
            const aiResult = await aiGateway.comparison.compareProducts(product1Id, product2Id, preferences);

            // 3. Write record into public.comparison_history table (non-blocking)
            try {
                logger.info(`[COMPARISON CONTROLLER] Logging search transaction to history for user ${userId || 'guest'}`, 'COMPARE');
                const historyEntry = {
                    user_id: userId || null,
                    product_1_id: Number(product1Id),
                    product_2_id: Number(product2Id),
                    comparison_data: aiResult
                };
                
                const { error: histErr } = await supabase.from('comparison_history').insert(historyEntry);
                if (histErr) throw histErr;
            } catch (histErr) {
                logger.warn(`[COMPARISON CONTROLLER] Non-blocking history log skipped: ${histErr.message}`, 'COMPARE');
            }

            // 4. Save results to comparison_scores table if a valid session exists
            if (userId) {
                try {
                    const scoreEntry = {
                        user_id: userId,
                        product_1_id: Number(product1Id),
                        product_2_id: Number(product2Id),
                        preference_scores: aiResult.scores || {},
                        winner_product_id: Number(aiResult.winner?.id || product1Id),
                        explanation: aiResult.explanation || aiResult.analysis || ''
                    };
                    const { error: scoreErr } = await supabase.from('comparison_scores').insert(scoreEntry);
                    if (scoreErr) throw scoreErr;
                } catch (scoreErr) {
                    logger.warn(`[COMPARISON CONTROLLER] Non-blocking analytical scores log skipped: ${scoreErr.message}`, 'COMPARE');
                }
            }

            return response.success(res, aiResult);

        } catch (err) {
            logger.error('[COMPARISON CONTROLLER] Fatal failure in comparison analysis pipeline.', err, 'COMPARE');
            next(err);
        }
    },

    /**
     * Saves a favorite product comparison pair for the user.
     */
    async save(req, res, next) {
        try {
            const { product1Id, product2Id, notes } = req.body;
            const userId = req.user?.id;

            if (!userId || !product1Id || !product2Id) {
                return response.error(res, 'User ID and both Product IDs are required to save a comparison.', null, 400);
            }

            logger.info(`[COMPARISON CONTROLLER] Saving comparison pair for user: ${userId}`, 'COMPARE');

            const { data, error } = await supabase.from('saved_comparisons').insert({
                user_id: userId,
                product_1_id: Number(product1Id),
                product_2_id: Number(product2Id),
                notes: notes || ''
            }).select();

            if (error) {
                if (error.code === '23505') { // Duplicate key constraint
                    return response.error(res, 'You have already saved this comparison.', null, 409);
                }
                throw error;
            }

            return response.success(res, data[0], 'Comparison saved successfully!');

        } catch (err) {
            logger.error('[COMPARISON CONTROLLER] Save comparison transaction failed.', err, 'COMPARE');
            next(err);
        }
    },

    /**
     * Fetches the comparison history for a specific user session.
     */
    async getHistory(req, res, next) {
        try {
            const { userId } = req.params;

            if (!userId) {
                return response.error(res, 'User ID parameter is required.', null, 400);
            }

            if (req.user.id !== userId) {
                logger.warn(`[COMPARISON CONTROLLER] Access Denied: User ${req.user.id} tried to view history of user ${userId}`, 'COMPARE');
                return response.error(res, 'Access Denied: You cannot view another user\'s history.', null, 403);
            }

            const { data, error } = await supabase
                .from('comparison_history')
                .select('*, product_1:products!product_1_id(*), product_2:products!product_2_id(*)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return response.success(res, data);

        } catch (err) {
            logger.error('[COMPARISON CONTROLLER] Failed to fetch history records.', err, 'COMPARE');
            next(err);
        }
    },

    /**
     * Fetches saved comparisons for a user.
     */
    async getSaved(req, res, next) {
        try {
            const { userId } = req.params;

            if (!userId) {
                return response.error(res, 'User ID parameter is required.', null, 400);
            }

            if (req.user.id !== userId) {
                logger.warn(`[COMPARISON CONTROLLER] Access Denied: User ${req.user.id} tried to view saved comparisons of user ${userId}`, 'COMPARE');
                return response.error(res, 'Access Denied: You cannot view another user\'s saved comparisons.', null, 403);
            }

            const { data, error } = await supabase
                .from('saved_comparisons')
                .select('*, product_1:products!product_1_id(*), product_2:products!product_2_id(*)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return response.success(res, data);

        } catch (err) {
            logger.error('[COMPARISON CONTROLLER] Failed to load saved comparisons.', err, 'COMPARE');
            next(err);
        }
    }
};
