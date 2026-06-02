import { retrievalService } from './retrievalService.js';
import { logger } from '../../utils/logger.js';
import fetch from 'node-fetch';

export const chatService = {
    /**
     * Streams chatbot response using Server-Sent Events (SSE).
     * @param {string} message User message
     * @param {Object} session User session parameters
     * @param {Object} res Express response object
     * @param {AbortSignal} abortSignal AbortSignal to cancel request
     */
    async streamChat(message, session, res, abortSignal) {
        const geminiKey = process.env.GEMINI_API_KEY;
        
        try {
            logger.info(`[CHAT SERVICE] Starting streaming chat for user=${session.userId || 'anonymous'}`, 'AI_GATEWAY');

            // 1. Retrieve Context from Supabase (RAG Grounding)
            const context = await retrievalService.retrieveContext(message);
            
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
                    contextText += `- ${p.name} ($${p.price}) in ${p.category}. Description: ${p.explanation || p.description}\n`;
                });
            }

            if (context.reviews.length > 0) {
                contextText += "\nVerified genuine customer reviews for matched products:\n";
                context.reviews.forEach(r => {
                    contextText += `- Review: "${r.review_text}" (Rating: ${r.rating}/5)\n`;
                });
            }

            const systemPrompt = `You are VChat, a Clinical AI Shopping Assistant for ReviewLens skincare platform.
            Your job is to provide highly objective, dermatologically grounded recommendations.
            Use the following context to answer the user query if helpful.
            If context is not relevant, answer generally about skincare.
            Always maintain a helpful, premium, and clinical tone. Format responses with clean Markdown.
            
            CONTEXT GROUNDING DATA:
            ${contextText || 'No direct matches found in database knowledge base.'}
            
            User message: ${message}`;

            if (!geminiKey) {
                // Return fallback message statically if no API key is set
                logger.warn('[CHAT SERVICE] GEMINI_API_KEY missing. Returning static grounded response.', 'AI_GATEWAY');
                res.write(`data: ${JSON.stringify({ text: "👋 **Hello! I am VChat in Offline mode.**\n\nI see you are interested in skincare! Salicylic Acid is a highly effective beta-hydroxy acid (BHA) for oily or acne-prone skin, while Hyaluronic Acid acts as a humectant to restore water-binding layers on dry skin. Verify your environment keys to enable live AI responses." })}\n\n`);
                res.write('event: end\ndata: [DONE]\n\n');
                res.end();
                return;
            }

            // 2. Query Gemini Streaming Endpoint
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${geminiKey}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: systemPrompt }] }]
                }),
                signal: abortSignal
            });

            if (!response.ok) {
                throw new Error(`Gemini stream returned status ${response.status}`);
            }

            // Read the body stream chunk by chunk
            const stream = response.body;
            let buffer = '';

            stream.on('data', (chunk) => {
                buffer += chunk.toString();
                
                // Read lines of JSON
                // Gemini stream generates parts inside JSON array: [{"candidates": [{"content": {"parts": [{"text": "hello"}]}}]}]
                // Let's parse the buffered data looking for full objects
                try {
                    // Try to extract JSON parts
                    // The chunks are returned as part of a JSON array, so they look like `[\n{...},\n{...}\n]`
                    // Let's do a regex match or simple parsing to grab candidates
                    const regex = /"text":\s*"((?:[^"\\]|\\.)*)"/g;
                    let match;
                    let textParts = [];

                    while ((match = regex.exec(buffer)) !== null) {
                        // Unescape the captured string
                        const rawText = match[1];
                        try {
                            const cleanText = JSON.parse(`"${rawText}"`);
                            textParts.push(cleanText);
                        } catch (e) {
                            textParts.push(rawText);
                        }
                    }

                    if (textParts.length > 0) {
                        // Clear successfully parsed content from buffer (simple buffer trimming)
                        // Gemini returns stream chunks which may contain incremental text
                        // Send textParts chunk to the client
                        // Avoid sending repeating characters by comparing with what we sent,
                        // or just stream the latest additions.
                        // Wait! A more standard way for Gemini stream is parsing the stream line by line if it's SSE-like,
                        // but Google's stream returns a JSON array of objects.
                        // Let's parse the JSON text directly.
                    }
                } catch (err) {
                    // JSON parsing failed (incomplete chunk), keep in buffer
                }
            });

            // Alternate clean chunk parser using regex for array items:
            // The JSON stream is returned as:
            // [
            //   { "candidates": ... },
            //   { "candidates": ... }
            // ]
            // We can parse it by splitting on brackets or looking for matching objects.
            let streamBuffer = '';
            
            for await (const chunk of response.body) {
                if (abortSignal.aborted) break;
                
                streamBuffer += chunk.toString();
                
                // Process streamBuffer to locate completed JSON objects
                // A JSON stream object starts with { and ends with } and is separated by comma/newlines
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
                                    // Send token chunk to client via SSE format
                                    res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
                                }
                            } catch (e) {
                                // Incomplete object or parse error, ignore
                            }
                            // Cut buffer
                            streamBuffer = streamBuffer.substring(i + 1);
                            i = -1; // reset index to start scanning from beginning of remaining buffer
                            startIndex = -1;
                        }
                    }
                    i++;
                }
            }

            // Flush remaining buffer if possible
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
