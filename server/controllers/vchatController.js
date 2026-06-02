/**
 * VChat Controller
 * Replaces the legacy chatController with the full agent orchestration pipeline.
 * Route: POST /api/ai/chat
 * Body:  { message, sessionContext? }
 * Response shape (preserves backward compatibility + adds rich data):
 *   { success: true, data: { response, type, data, followUpQuestions, timestamp } }
 */

import { vchatOrchestrate } from '../services/vchat/agent.js';
import { response } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const vchatController = {
    async chat(req, res, next) {
        try {
            const { message, sessionContext } = req.body;

            if (!message || typeof message !== 'string' || message.trim().length === 0) {
                return response.error(res, 'Message is required and must be a non-empty string.', null, 400);
            }

            if (message.trim().length > 2000) {
                return response.error(res, 'Message is too long. Please keep it under 2000 characters.', null, 400);
            }

            // Extract userId from authenticated user (set by authMiddleware)
            const userId = req.user?.id || null;

            // Extract API keys from request headers
            const geminiKey = req.headers['x-gemini-key'] || null;
            const openaiKey = req.headers['x-openai-key'] || null;

            logger.info(`[VCHAT CONTROLLER] Incoming chat from user=${userId || 'guest'}: "${message.substring(0, 100)}"`, 'VCHAT');

            // Run the agent orchestration pipeline
            const result = await vchatOrchestrate({
                message: message.trim(),
                userId,
                sessionContext: sessionContext || {},
                geminiKey,
                openaiKey,
            });

            // The result always has: { response, type, data, followUpQuestions, timestamp }
            // We return it preserving the legacy `response` key that the frontend expects
            return response.success(res, result);

        } catch (err) {
            logger.error(`[VCHAT CONTROLLER] Fatal error in chat pipeline: ${err.message}`, err, 'VCHAT');
            // Return a graceful degraded response instead of a 500 crash
            return response.success(res, {
                response: `⚠️ **VChat Offline:** The AI Shopping Assistant is temporarily unavailable. Please try again shortly.\n\n*Technical details: ${err.message}*`,
                type: 'error',
                data: null,
                followUpQuestions: [],
                timestamp: new Date().toISOString(),
            });
        }
    }
};
