import fetch from 'node-fetch';
import { logger } from '../../utils/logger.js';

export const llmClient = {
    /**
     * Centralized query executor — Groq only (llama-3.3-70b-versatile).
     */
    async query({ prompt, jsonMode = false, keys = {} }) {
        const groqKey = keys.groqKey || process.env.GROQ_API_KEY || null;

        if (!groqKey) {
            throw new Error('GROQ_API_KEY is missing. Cannot process LLM query.');
        }

        try {
            logger.info('[LLM CLIENT] Sending query to Groq (llama-3.3-70b-versatile)...', 'AI_LLM_CLIENT');
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
                new Promise((_, reject) => setTimeout(() => reject(new Error('Groq Query Timeout')), 10000))
            ]);

            if (res.ok) {
                const json = await res.json();
                const text = json.choices?.[0]?.message?.content;
                if (text) {
                    logger.info('[LLM CLIENT] Groq query succeeded.', 'AI_LLM_CLIENT');
                    return text;
                }
            }

            const errBody = await res.text().catch(() => '');
            logger.error(`[LLM CLIENT] Groq API failed with status ${res.status}: ${errBody}`, 'AI_LLM_CLIENT');
            throw new Error(`Groq API returned status ${res.status}`);
        } catch (err) {
            logger.error(`[LLM CLIENT] Groq API error: ${err.message}`, 'AI_LLM_CLIENT');
            throw err;
        }
    }
};
