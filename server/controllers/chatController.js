import { aiService } from '../services/aiService.js';
import { response } from '../utils/response.js';

export const chatController = {
    async chat(req, res, next) {
        try {
            const { message } = req.body;
            if (!message) {
                return response.error(res, 'Message is required', null, 400);
            }

            const data = await aiService.ragChat(message);
            return response.success(res, { response: data.response });
        } catch (err) {
            // Check for service unreachable bridge issues
            return response.error(
                res, 
                'Service unavailable', 
                '⚠️ **Connection Error:** The AI service is currently unavailable. Please ensure the ML backend is running.', 
                503
            );
        }
    }
};
