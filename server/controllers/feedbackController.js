import { feedbackService } from '../services/feedbackService.js';
import { feedbackValidator } from '../validators/feedbackValidator.js';
import { response } from '../utils/response.js';

export const feedbackController = {
    async submit(req, res, next) {
        try {
            const validationError = feedbackValidator.validateSubmission(req.body);
            if (validationError) {
                return response.error(res, validationError, null, 400);
            }

            const result = await feedbackService.submitFeedback(req.body);
            return response.success(res, {
                success: true,
                verdict: result.verdict,
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
