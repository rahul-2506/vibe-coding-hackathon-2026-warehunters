/**
 * VChat Controller
 * Replaces the legacy chatController with the full agent orchestration pipeline.
 * Route: POST /api/ai/chat
 * Body:  { message, sessionContext? }
 * Response shape (preserves backward compatibility + adds rich data):
 *   { success: true, data: { response, type, data, followUpQuestions, timestamp } }
 */

import { streamRouter } from '../src/chat/streamRouter.js';
import { aiGateway } from '../services/gateway/aiGateway.js';
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
            const userId = req.user?.id || 'anonymous';

            // Extract API keys from request headers
            const geminiKey = req.headers['x-gemini-key'] || null;
            const openaiKey = req.headers['x-openai-key'] || null;

            logger.info(`[VCHAT CONTROLLER] Incoming chat from user=${userId}: "${message.substring(0, 100)}"`, 'VCHAT');

            // Set headers for simulation or use streamRouter for uniform response structure
            let fullResponseText = '';
            const simulatedRes = {
                write(chunk) {
                    if (chunk.startsWith('data: ')) {
                        try {
                            const dataStr = chunk.slice(6).trim();
                            if (dataStr === '[DONE]') return;
                            const parsed = JSON.parse(dataStr);
                            if (parsed.text) {
                                fullResponseText += parsed.text;
                            }
                        } catch (e) {}
                    }
                },
                end() {}
            };

            const abortController = new AbortController();

            // Run the agent orchestration pipeline through our SSE stream router and capture text
            await streamRouter.stream(
                message.trim(),
                sessionContext || {},
                userId,
                simulatedRes,
                abortController.signal,
                { geminiKey, openaiKey }
            );

            // Construct final response object shape matching legacy
            const result = {
                response: fullResponseText || `⚠️ **VChat Offline:** Failed to generate recommendations. Please try again.`,
                type: 'text',
                data: null,
                followUpQuestions: ['Start Skincare Discovery Flow 🚀', 'Build me a routine 🌅'],
                timestamp: new Date().toISOString()
            };

            return response.success(res, result);

        } catch (err) {
            logger.error(`[VCHAT CONTROLLER] Fatal error in chat pipeline: ${err.message}`, err, 'VCHAT');
            return response.success(res, {
                response: `⚠️ **VChat Offline:** The AI Shopping Assistant is temporarily unavailable. Please try again shortly.\n\n*Technical details: ${err.message}*`,
                type: 'error',
                data: null,
                followUpQuestions: [],
                timestamp: new Date().toISOString(),
            });
        }
    },

    async stream(req, res, next) {
        const { message, sessionContext } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return response.error(res, 'Message is required and must be a non-empty string.', null, 400);
        }

        // Set SSE Headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const userId = req.user?.id || 'anonymous';
        const abortController = new AbortController();

        req.on('close', () => {
            logger.info(`[VCHAT STREAM] Connection closed by user=${userId}. Aborting generation stream.`, 'VCHAT');
            abortController.abort();
        });

        try {
            logger.info(`[VCHAT STREAM] Initializing stream query for user=${userId}: "${message.substring(0, 50)}"`, 'VCHAT');
            const geminiKey = req.headers['x-gemini-key'] || null;
            const openaiKey = req.headers['x-openai-key'] || null;
            
            await streamRouter.stream(
                message, 
                sessionContext || {}, 
                userId,
                res, 
                abortController.signal, 
                { geminiKey, openaiKey }
            );
        } catch (err) {
            logger.error(`[VCHAT STREAM FATAL] Generation stream aborted or failed: ${err.message}`, err, 'VCHAT');
            res.write(`data: ${JSON.stringify({ text: `\n\n⚠️ **Streaming Interrupted:** ${err.message}` })}\n\n`);
            res.write('event: end\ndata: [DONE]\n\n');
            res.end();
        }
    }
};
