import { intentDetector } from '../ai/intentDetector.js';
import { memoryManager } from '../ai/memoryManager.js';
import { agentPlanner } from '../ai/agentPlanner.js';
import { toolRouter } from '../ai/toolRouter.js';
import { reasoningEngine } from '../ai/reasoningEngine.js';
import { responseGenerator } from '../ai/responseGenerator.js';
import { reflectionStep } from '../ai/reflectionStep.js';
import { conversationSummarizer } from '../ai/conversationSummarizer.js';
import { ragEngine } from '../ai/ragEngine.js';
import { logger } from '../../utils/logger.js';
import fetch from 'node-fetch';

export const streamRouter = {
    /**
     * Executes the agent loop and streams thoughts + token chunks via SSE.
     */
    async stream(message, sessionContext, userId, res, abortSignal, keys = {}) {
        logger.info(`[STREAM ROUTER] Starting agent loop for user=${userId}`, 'AI_STREAM');

        const writeThought = (status) => {
            if (!abortSignal.aborted) {
                res.write(`data: ${JSON.stringify({ status })}\n\n`);
            }
        };

        const writeTextChunk = (text) => {
            if (!abortSignal.aborted) {
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
        };

        try {
            // Stage 1: Intent & Entity Extraction
            writeThought('Analyzing your intent and extraction entities...');
            const detection = await intentDetector.detectIntent(message, keys);
            const { intent, entities } = detection;

            // Stage 2: Load Preference Memory
            writeThought('Recalling your skin profile preferences...');
            let memory = await memoryManager.updateMemory(userId, message, keys);

            // Stage 3: Agent Planning
            writeThought('Formulating search and analysis strategy...');
            const plan = agentPlanner.plan(intent, entities, memory);

            // Stage 4: Tool Execution
            let toolResults = { success: true };
            if (plan.tools_to_use && plan.tools_to_use.length > 0) {
                const targetTool = plan.tools_to_use[0];
                if (targetTool === 'productSearch') {
                    writeThought('Searching catalog and external databases...');
                } else if (targetTool === 'comparisonTool') {
                    writeThought('Comparing clinical formulas side-by-side...');
                } else if (targetTool === 'reviewAnalyzer') {
                    writeThought('Analyzing verified review authenticity indexes...');
                } else if (targetTool === 'ingredientAnalyzer') {
                    writeThought('Checking comedogenic risks and ingredient safety...');
                } else {
                    writeThought(`Executing active tool: ${targetTool}...`);
                }

                toolResults = await toolRouter.execute(plan, entities, userId, keys);
            }

            // Stage 5: Hybrid Search (RAG Grounding)
            writeThought('Retrieving grounding dermatological articles...');
            const filters = {
                category: entities.category || null,
                skinType: memory.skin_type || entities.skin_type || null,
                concern: entities.concern || (memory.concerns && memory.concerns[0]) || null,
                budget: entities.budget || memory.budget || null
            };
            const ragContext = await ragEngine.hybridSearch(message, filters, keys);

            // Stage 6: Reasoning Engine
            writeThought('Reasoning about appropriate answers...');
            const reasoning = reasoningEngine.compileReasoning({
                intent,
                entities,
                memory,
                plan,
                ragContext
            });

            // Stage 7: Reflection Step (Evaluate Draft response)
            writeThought('Evaluating recommendation safety and confidence...');
            
            // Check conversation summarizer triggers (if history > 20 messages)
            const session = await memoryManager.loadMemory(userId);
            const history = session.chatHistory || [];
            if (history.length >= 20) {
                writeThought('Summarizing transcript history to save token bandwidth...');
                const summaryObj = await conversationSummarizer.summarizeHistory(history, memory, keys);
                if (summaryObj) {
                    memory.conversation_summary = summaryObj.summary;
                    memory.concerns = [...new Set([...(memory.concerns || []), ...(summaryObj.facts || [])])];
                    await memoryManager.saveMemory(userId, memory);
                }
            }

            // Stage 8: Response Generation
            writeThought('Formulating empathetic response layout...');
            const finalPayload = await responseGenerator.generateResponse({
                userQuery: message,
                reasoning,
                toolResults,
                plan
            }, keys);

            // Stage 9: Final Reflection Auditing
            const reflection = await reflectionStep.reflect(message, finalPayload.response, plan, keys);
            const verifiedText = reflection.text;

            // Stream final text tokens to user (simulated fast tokens or direct SSE pipe)
            writeThought(''); // Clear thought loading indicator
            
            // Stream the verifiedText character by character or word by word to emulate real-time generation
            const tokens = verifiedText.split(' ');
            for (let i = 0; i < tokens.length; i++) {
                if (abortSignal.aborted) break;
                writeTextChunk(tokens[i] + ' ');
                // 15ms sleep to emulate network streaming
                await new Promise(r => setTimeout(r, 15));
            }

            // Finish stream
            if (!abortSignal.aborted) {
                res.write('event: end\ndata: [DONE]\n\n');
                res.end();
            }

        } catch (err) {
            logger.error(`[STREAM ROUTER FATAL] Error in streaming agent loop: ${err.message}`, 'AI_STREAM');
            writeThought('');
            writeTextChunk(`\n\n⚠️ **Streaming Generation Aborted:** ${err.message}`);
            res.write('event: end\ndata: [DONE]\n\n');
            res.end();
        }
    }
};
