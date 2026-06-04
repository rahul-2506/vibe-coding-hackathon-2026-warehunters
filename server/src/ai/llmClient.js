import fetch from 'node-fetch';
import { logger } from '../../utils/logger.js';

export const llmClient = {
    /**
     * Centralized query executor targeting Gemini first, falling back to Groq.
     * @param {Object} params { prompt, jsonMode, keys }
     */
    async query({ prompt, jsonMode = false, keys = {} }) {
        const geminiKey = keys.geminiKey || process.env.GEMINI_API_KEY || (process.env.AI_API_KEY?.startsWith('AIzaSy') ? process.env.AI_API_KEY : null);
        const groqKey = keys.groqKey || process.env.GROQ_API_KEY || null;

        // 1. Attempt Gemini
        if (geminiKey && !geminiKey.startsWith('gsk_')) {
            try {
                logger.info('[LLM CLIENT] Attempting Gemini API query...', 'AI_LLM_CLIENT');
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
                const payload = {
                    contents: [{ parts: [{ text: prompt }] }]
                };

                if (jsonMode) {
                    payload.generationConfig = {
                        responseMimeType: "application/json"
                    };
                }

                const res = await Promise.race([
                    fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini Query Timeout')), 5000))
                ]);

                if (res.ok) {
                    const json = await res.json();
                    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        logger.info('[LLM CLIENT] Gemini API query succeeded.', 'AI_LLM_CLIENT');
                        return text;
                    }
                }
                logger.warn(`[LLM CLIENT] Gemini API failed with status ${res.status}. Cascading to Groq fallback.`, 'AI_LLM_CLIENT');
            } catch (err) {
                logger.warn(`[LLM CLIENT] Gemini API error: ${err.message}. Cascading to Groq fallback.`, 'AI_LLM_CLIENT');
            }
        }

        // 2. Fallback to Groq
        if (groqKey) {
            try {
                logger.info('[LLM CLIENT] Attempting Groq API query (Llama-3.3-70b)...', 'AI_LLM_CLIENT');
                const url = 'https://api.groq.com/openai/v1/chat/completions';
                const payload = {
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }]
                };

                if (jsonMode) {
                    payload.response_format = { type: 'json_object' };
                }

                const res = await Promise.race([
                    fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${groqKey}`
                        },
                        body: JSON.stringify(payload)
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Groq Query Timeout')), 5000))
                ]);

                if (res.ok) {
                    const json = await res.json();
                    const text = json.choices?.[0]?.message?.content;
                    if (text) {
                        logger.info('[LLM CLIENT] Groq API query succeeded.', 'AI_LLM_CLIENT');
                        return text;
                    }
                }
                logger.error(`[LLM CLIENT] Groq API failed with status ${res.status}.`, 'AI_LLM_CLIENT');
            } catch (err) {
                logger.error(`[LLM CLIENT] Groq API error: ${err.message}`, 'AI_LLM_CLIENT');
            }
        }

        throw new Error('Both Gemini and Groq LLM queries failed or had missing credentials.');
    }
};
