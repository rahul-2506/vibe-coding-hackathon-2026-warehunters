import { logger } from '../../utils/logger.js';
import { llmClient } from './llmClient.js';

export const conversationSummarizer = {
    /**
     * Condenses chat history if it exceeds a limit (e.g. 20 messages).
     * Returns updated memory with updated summary, facts, and preferences.
     */
    async summarizeHistory(chatHistory, memory, keys = {}) {
        if (!chatHistory || chatHistory.length < 20) {
            return null; // No summarization needed yet
        }

        logger.info(`[SUMMARIZER] Truncation limit hit (${chatHistory.length} messages). Generating context summary...`, 'AI_SUMMARIZER');

        const geminiKey = keys.geminiKey || process.env.GEMINI_API_KEY || (process.env.AI_API_KEY?.startsWith('AIzaSy') ? process.env.AI_API_KEY : null);
        const groqKey = keys.groqKey || process.env.GROQ_API_KEY;

        let summaryText = `The conversation contains ${chatHistory.length} turns discussing skincare.`;
        let facts = [];
        let preferences = [];

        if ((geminiKey && !geminiKey.startsWith('gsk_')) || groqKey) {
            try {
                const transcript = chatHistory.map(h => `${h.role === 'assistant' ? 'AI' : 'User'}: ${h.text}`).join('\n');
                
                const prompt = `You are a conversation summarization engine.
Condense the following conversation transcript.
Extract a brief summary of the conversation, a list of facts about the user's skin, and their shopping preferences.

TRANSCRIPT:
${transcript}

Return a JSON object:
{
  "summary": "Brief 2-3 sentence overview of the conversation flow",
  "facts": ["list", "of", "skin", "facts", "extracted"],
  "preferences": ["list", "of", "shopping", "preferences", "extracted"]
}
Return ONLY valid JSON.`;

                const text = await llmClient.query({
                    prompt,
                    jsonMode: true,
                    keys
                });

                if (text) {
                    const parsed = JSON.parse(text);
                    summaryText = parsed.summary;
                    facts = parsed.facts || [];
                    preferences = parsed.preferences || [];
                }
            } catch (err) {
                logger.error(`[SUMMARIZER] LLM summarization failed: ${err.message}`, 'AI_SUMMARIZER');
            }
        } else {
            // Rule-based offline backup summary
            summaryText = `User is discussing products for skin concerns. Verified skin type: ${memory.skin_type || 'normal'}. Concerns discussed: ${memory.concerns?.join(', ') || 'none'}.`;
            facts = memory.concerns || [];
            preferences = memory.favorite_brands || [];
        }

        // Return condensed details
        return {
            summary: summaryText,
            facts,
            preferences
        };
    }
};
