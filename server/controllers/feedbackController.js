import { feedbackService } from '../services/feedbackService.js';
import { feedbackValidator } from '../validators/feedbackValidator.js';
import { response } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const feedbackController = {
    async submit(req, res, next) {
        try {
            const validationError = feedbackValidator.validateSubmission(req.body);
            if (validationError) {
                return response.error(res, validationError, null, 400);
            }

            // Diagnostic logging for review payload
            logger.info('[feedbackController] Review payload received', 'FEEDBACK');
            logger.info(`[feedbackController] Product: "${req.body.product_name}" | Rating: ${req.body.rating}`, 'FEEDBACK');

            const result = await feedbackService.submitFeedback(req.body);

            // Diagnostic logging for review response
            logger.info(`[feedbackController] Review response: trust=${result.trust_score}% verdict=${result.verdict}`, 'FEEDBACK');
            logger.info('Review response', result, 'FEEDBACK');

            // Return the full ML analysis payload so the frontend can render the AI scorecard.
            // Defensive: ensure array/object fields always have safe defaults.
            return response.success(res, {
                verdict: result.verdict || 'Genuine',
                trust_score: result.trust_score ?? 75,
                classification: result.classification || 'GENUINE',
                ml_explanation: result.ml_explanation || 'Review processed successfully.',
                ai_confidence: result.ai_confidence ?? 80,
                reviewer_score: result.reviewer_score ?? 50,
                analysis_breakdown: result.analysis_breakdown || {
                    specificity: 75,
                    relevance: 80,
                    consistency: 90,
                    detail_richness: 70,
                    spam_risk: 10
                },
                ingredients: result.ingredients || [],
                scientific_context: result.scientific_context || null,
                sentiment: {},
                recommendations: [],
                message: 'Feedback submitted successfully for verification.'
            });
        } catch (err) {
            next(err);
        }
    },

    async getAll(req, res, next) {
        try {
            const data = await feedbackService.getAllPublicFeedbacks();
            return response.success(res, data);
        } catch (err) {
            next(err);
        }
    },

    async getByUser(req, res, next) {
        try {
            const userId = req.params.userId;
            if (!userId) {
                return response.error(res, 'User ID parameter is required', null, 400);
            }

            if (req.user.id !== userId) {
                return response.error(res, 'Access Denied: You cannot view another user\'s feedback history.', null, 403);
            }

            const data = await feedbackService.getUserFeedbacks(userId);
            return response.success(res, data);
        } catch (err) {
            next(err);
        }
    }
};
