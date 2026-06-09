import { retrievalService } from './retrievalService.js';
import { logger } from '../../utils/logger.js';
import fetch from 'node-fetch';
import { sessionMemory } from '../vchat/sessionMemory.js';

export const chatService = {
    /**
     * Streams chatbot response using Server-Sent Events (SSE).
     * @param {string} message User message
     * @param {Object} session User session parameters
     * @param {Object} res Express response object
     * @param {AbortSignal} abortSignal AbortSignal to cancel request
     */
    async streamChat(message, session, res, abortSignal, userKeys = {}) {
        const geminiKey = userKeys.geminiKey || process.env.GEMINI_API_KEY || (process.env.AI_API_KEY?.startsWith('AIzaSy') ? process.env.AI_API_KEY : null);
        const openaiKey = userKeys.openaiKey || process.env.OPENAI_API_KEY;
        const groqKey = process.env.GROQ_API_KEY || (process.env.AI_API_KEY?.startsWith('gsk_') ? process.env.AI_API_KEY : null);
        
        try {
            logger.info(`[CHAT SERVICE] Starting streaming chat for user=${session.userId || 'anonymous'}`, 'AI_GATEWAY');

            // Sync sessionContext if provided from frontend
            if (session.sessionContext && typeof session.sessionContext === 'object') {
                sessionMemory.update(session.userId || 'anonymous', session.sessionContext);
            }
            // Parse & save prompt to history
            const sessionStore = sessionMemory.learnFromMessage(session.userId || 'anonymous', message);

            // 1. Retrieve Context from Supabase (RAG Grounding)
            const context = await retrievalService.retrieveContext(message, session.userId || 'anonymous');
            if (context.products && context.products.length > 0) {
                sessionMemory.recordShownProducts(session.userId || 'anonymous', context.products);
            }
            
            // Build grounded system prompt
            let contextText = "";
            if (context.knowledgeSnippets.length > 0) {
                contextText += "Scientific facts matching user query:\n";
                context.knowledgeSnippets.forEach(s => {
                    contextText += `- ${s.topic}: ${s.content}\n`;
                });
            }
            
            if (context.products.length > 0) {
                contextText += "\nMatching inventory products:\n";
                context.products.forEach(p => {
                    contextText += `- ${p.name} ($${p.price}) in ${p.category}. Rating: ${p.rating}/5, Trust Score: ${p.trust_score}/100. Description: ${p.explanation || p.description}\n`;
                });
            }
            
            if (context.reviews.length > 0) {
                contextText += "\nVerified genuine customer reviews for matched products:\n";
                context.reviews.forEach(r => {
                    contextText += `- Review: "${r.review_text}" (Rating: ${r.rating}/5)\n`;
                });
            }

            const systemInstruction = `You are VChat, a premium, objective AI Shopping Assistant for the ReviewLens e-commerce platform.
Your job is to provide highly objective, data-backed product recommendations and answers across all categories (including Beauty, Electronics, Fashion, Home & Living, and Groceries).
Use the following context to answer the user query if helpful. Use prices, ratings, trust scores, and categories from our matching inventory products.
Always mention the prices, ratings, trust scores, and categories of the products you are recommending or discussing.
If context is not relevant, answer generally using your AI knowledge base.
Always maintain a helpful, professional, and trustworthy tone. Format responses with clean Markdown.

CONTEXT GROUNDING DATA:
${contextText || 'No direct matches found in database knowledge base.'}`;

            // Log raw prompt payload
            console.log(`Prompt sent to AI: ${JSON.stringify({ systemInstruction, history: sessionStore.chatHistory })}`);

            // Case B: Gemini disabled (Primary Stream Option)
            if (false) {
                logger.info('[CHAT SERVICE] Executing live streaming via Gemini API.', 'AI_GATEWAY');
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${geminiKey}`;
                
                const contents = (sessionStore.chatHistory || []).map(h => ({
                    role: h.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: h.text }]
                }));
                if (contents.length === 0) {
                    contents.push({ role: 'user', parts: [{ text: message }] });
                }

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        systemInstruction: {
                            parts: [{ text: systemInstruction }]
                        }
                    }),
                    signal: abortSignal
                });

                if (!response.ok) {
                    throw new Error(`Gemini stream returned status ${response.status}`);
                }

                let streamBuffer = '';
                let fullTextAccumulator = '';
                for await (const chunk of response.body) {
                    if (abortSignal.aborted) break;
                    streamBuffer += chunk.toString();
                    
                    let braceCount = 0;
                    let startIndex = -1;
                    let i = 0;

                    while (i < streamBuffer.length) {
                        const char = streamBuffer[i];
                        if (char === '{') {
                            if (braceCount === 0) startIndex = i;
                            braceCount++;
                        } else if (char === '}') {
                            braceCount--;
                            if (braceCount === 0 && startIndex !== -1) {
                                const jsonStr = streamBuffer.substring(startIndex, i + 1);
                                try {
                                    const parsed = JSON.parse(jsonStr);
                                    const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                                    if (textChunk) {
                                        fullTextAccumulator += textChunk;
                                        res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
                                    }
                                } catch (e) {
                                    // ignore incomplete chunks
                                }
                                streamBuffer = streamBuffer.substring(i + 1);
                                i = -1;
                                startIndex = -1;
                            }
                        }
                        i++;
                    }
                }
                sessionMemory.addAssistantMessage(session.userId || 'anonymous', fullTextAccumulator);
            }
            // Case A: Groq Key is present (Fallback Stream Option)
            if (groqKey) {
                logger.info('[CHAT SERVICE] Executing live streaming via Groq API.', 'AI_GATEWAY');
                const url = 'https://api.groq.com/openai/v1/chat/completions';
                
                const messages = [
                    { role: "system", content: systemInstruction },
                    ...(sessionStore.chatHistory || []).map(h => ({
                        role: h.role === 'assistant' ? 'assistant' : 'user',
                        content: h.text
                    }))
                ];

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${groqKey}`
                    },
                    body: JSON.stringify({
                        model: "llama-3.3-70b-versatile",
                        messages,
                        stream: true
                    }),
                    signal: abortSignal
                });

                if (!response.ok) {
                    throw new Error(`Groq stream returned status ${response.status}`);
                }

                let buffer = '';
                let fullTextAccumulator = '';
                for await (const chunk of response.body) {
                    if (abortSignal.aborted) break;
                    buffer += chunk.toString();
                    
                    let lines = buffer.split('\n');
                    buffer = lines.pop(); // keep last incomplete line in buffer
                    
                    for (const line of lines) {
                        const cleanLine = line.trim();
                        if (!cleanLine) continue;
                        if (cleanLine.startsWith('data: ')) {
                            const dataStr = cleanLine.substring(6).trim();
                            if (dataStr === '[DONE]') continue;
                            try {
                                const parsed = JSON.parse(dataStr);
                                const textChunk = parsed.choices?.[0]?.delta?.content;
                                if (textChunk) {
                                    fullTextAccumulator += textChunk;
                                    res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
                                }
                            } catch (e) {
                                // ignore partial JSON
                            }
                        }
                    }
                }
                sessionMemory.addAssistantMessage(session.userId || 'anonymous', fullTextAccumulator);
            }
            // Case C: No direct streaming keys, but Python ML service is healthy (Simulated stream)
            else {
                // Import dynamically to avoid circular references
                const { aiService } = await import('../aiService.js');
                const health = await aiService.verifyAIHealth();
                
                if (health) {
                    logger.info('[CHAT SERVICE] Streaming keys missing. Routing query to Python AI RAG Server (Simulated Stream).', 'AI_GATEWAY');
                    const fullPrompt = `${systemInstruction}\n\nUser message: ${message}`;
                    const chatResult = await aiService.ragChat(fullPrompt, null, openaiKey);
                    const responseText = chatResult.response || chatResult.reply || '';
                    
                    // Simulate stream by writing tokens in chunks
                    const chunkSize = 8;
                    for (let i = 0; i < responseText.length; i += chunkSize) {
                        if (abortSignal.aborted) break;
                        const chunk = responseText.substring(i, i + chunkSize);
                        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
                        // brief sleep to simulate network speed
                        await new Promise(r => setTimeout(r, 10));
                    }
                    sessionMemory.addAssistantMessage(session.userId || 'anonymous', responseText);
                } else {
                    // Case D: Everything is completely down. Return detailed offline fallback.
                    logger.warn('[CHAT SERVICE] All AI engines are offline. Returning structured offline response.', 'AI_GATEWAY');
                    const fallbackText = "👋 **Hello! I am VChat in Offline mode.**\n\nI see you are interested in skincare! Salicylic Acid is a highly effective beta-hydroxy acid (BHA) for oily or acne-prone skin, while Hyaluronic Acid acts as a humectant to restore water-binding layers on dry skin. Verify your environment keys to enable live AI responses.";
                    res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
                    sessionMemory.addAssistantMessage(session.userId || 'anonymous', fallbackText);
                }
            }

            res.write('event: end\ndata: [DONE]\n\n');
            res.end();
            logger.info('[CHAT SERVICE] Stream generation finished successfully.', 'AI_GATEWAY');

        } catch (err) {
            if (err.name === 'AbortError') {
                logger.info('[CHAT SERVICE] Stream request aborted by user.', 'AI_GATEWAY');
            } else {
                logger.error('[CHAT SERVICE FATAL] Streaming request failed:', err, 'AI_GATEWAY');
                res.write(`data: ${JSON.stringify({ text: `\n\n⚠️ **Streaming Interrupted:** I encountered an issue downloading the stream. Please try again. (Details: ${err.message})` })}\n\n`);
                res.write('event: end\ndata: [DONE]\n\n');
                res.end();
            }
        }
    }
};
