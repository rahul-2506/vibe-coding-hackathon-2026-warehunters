import { supabase } from '../../db.js';
import { logger } from '../../utils/logger.js';
import { llmClient } from './llmClient.js';

const DEFAULT_MEMORY = {
    skin_type: '',
    concerns: [],
    budget: '',
    favorite_brands: [],
    allergies: [],
    past_recommendations: [],
    conversation_summary: '',
    tool_history: []
};

export const memoryManager = {
    /**
     * Loads the persistent user memory profile from PostgreSQL.
     * Fallbacks to local in-memory store if tables are missing.
     */
    async loadMemory(userId) {
        if (!userId) userId = 'anonymous';
        logger.info(`[MEMORY MANAGER] Loading memory for user=${userId}`, 'AI_MEMORY');

        try {
            const { data, error } = await supabase
                .from('user_memories')
                .select('memory')
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // Entry does not exist, initialize it
                    logger.info(`[MEMORY MANAGER] No memory found. Initializing profile for user=${userId}`, 'AI_MEMORY');
                    await this.saveMemory(userId, DEFAULT_MEMORY);
                    return { ...DEFAULT_MEMORY };
                }
                throw error;
            }

            return { ...DEFAULT_MEMORY, ...data.memory };
        } catch (err) {
            logger.warn(`[MEMORY MANAGER] DB failed to load memory: ${err.message}. Returning default.`, 'AI_MEMORY');
            return { ...DEFAULT_MEMORY };
        }
    },

    /**
     * Saves user memory profile to PostgreSQL.
     */
    async saveMemory(userId, memory) {
        if (!userId) userId = 'anonymous';
        logger.info(`[MEMORY MANAGER] Saving memory for user=${userId}`, 'AI_MEMORY');

        try {
            const { error } = await supabase
                .from('user_memories')
                .upsert({
                    user_id: userId,
                    memory: memory,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            return true;
        } catch (err) {
            logger.error(`[MEMORY MANAGER] Failed to save memory to PostgreSQL: ${err.message}`, 'AI_MEMORY');
            return false;
        }
    },

    /**
     * Auto-extracts preferences from user message and updates memory.
     */
    async updateMemory(userId, message, keys = {}) {
        if (!userId) userId = 'anonymous';
        const memory = await this.loadMemory(userId);

        const geminiKey = keys.geminiKey || process.env.GEMINI_API_KEY || (process.env.AI_API_KEY?.startsWith('AIzaSy') ? process.env.AI_API_KEY : null);

        // Rule-based extraction first (Offline backup)
        const lowerMsg = message.toLowerCase();

        // Skin Type
        const skinTypes = ['oily', 'dry', 'sensitive', 'normal', 'combination'];
        const foundSkin = skinTypes.find(st => lowerMsg.includes(st));
        if (foundSkin) {
            memory.skin_type = foundSkin;
        }

        // Budget
        const budgetMatch = lowerMsg.match(/(?:budget|under|price|cost|below)\s*(?:of|is)?\s*(?:rs\.?\s*|₹|\$)?\s*(\d+)/i);
        if (budgetMatch) {
            memory.budget = budgetMatch[1];
        }

        // Concerns
        const concernKeywords = {
            'acne': ['acne', 'pimple', 'blackhead', 'breakout', 'blemish'],
            'dark spots': ['dark spot', 'hyperpigment', 'melasma', 'sun damage', 'tan'],
            'anti-aging': ['wrinkle', 'fine line', 'aging', 'anti-age'],
            'dryness': ['dry skin', 'dryness', 'flaky'],
            'oily skin': ['oily skin', 'excess oil', 'sebum'],
            'sensitivity': ['sensitive', 'redness', 'rosacea', 'irritation']
        };

        for (const [concern, keywords] of Object.entries(concernKeywords)) {
            if (keywords.some(kw => lowerMsg.includes(kw))) {
                if (!memory.concerns.includes(concern)) {
                    memory.concerns.push(concern);
                }
            }
        }

        // Allergies (e.g. "allergic to L-Ascorbic Acid")
        const allergyMatch = lowerMsg.match(/(?:allergic to|allergy to|sensitive to)\s+([a-zA-Z\s]+)/i);
        if (allergyMatch) {
            const allergy = allergyMatch[1].trim();
            if (!memory.allergies.includes(allergy)) {
                memory.allergies.push(allergy);
            }
        }

        // Favorite Brands
        const brands = ['himalaya', 'derma co', 'mamaearth', 'minimalist', 'luminis', 'dermaglow', 'cetaphil', 'cerave'];
        brands.forEach(brand => {
            if (lowerMsg.includes(brand)) {
                if (!memory.favorite_brands.includes(brand)) {
                    memory.favorite_brands.push(brand);
                }
            }
        });

        const groqKey = keys.groqKey || process.env.GROQ_API_KEY;
        // LLM refinement (if online)
        if ((geminiKey && !geminiKey.startsWith('gsk_')) || groqKey) {
            try {
                const prompt = `You are a user preference extraction engine.
Analyze the user message and extract details to update the current memory profile.
Ensure values are consistent. Do not delete existing values unless the user explicitly contradicts them (e.g., "I don't have dry skin anymore, it is oily").

CURRENT PROFILE:
${JSON.stringify(memory)}

USER MESSAGE: "${message}"

Return a complete JSON profile containing keys: skin_type, concerns, budget, favorite_brands, allergies, past_recommendations, conversation_summary.
Return ONLY valid JSON.`;

                const text = await llmClient.query({
                    prompt,
                    jsonMode: true,
                    keys
                });

                if (text) {
                    const parsed = JSON.parse(text);
                    // Merge parsed memory with tool_history from existing memory
                    parsed.tool_history = memory.tool_history || [];
                    logger.info(`[MEMORY MANAGER] LLM successfully updated preferences: ${JSON.stringify(parsed)}`, 'AI_MEMORY');
                    await this.saveMemory(userId, parsed);
                    return parsed;
                }
            } catch (err) {
                logger.error(`[MEMORY MANAGER] LLM profile extraction failed: ${err.message}`, 'AI_MEMORY');
            }
        }

        // Save updated local rules memory
        await this.saveMemory(userId, memory);
        return memory;
    },

    /**
     * Appends a tool execution block into the active session history log.
     */
    async logToolUsage(userId, tool, query, resultCount) {
        if (!userId) userId = 'anonymous';
        try {
            const memory = await this.loadMemory(userId);
            if (!memory.tool_history) memory.tool_history = [];

            // Add new usage log, cap history length to last 15 calls to save space
            memory.tool_history.unshift({
                tool,
                query,
                result_count: resultCount,
                timestamp: new Date().toISOString()
            });
            memory.tool_history = memory.tool_history.slice(0, 15);

            await this.saveMemory(userId, memory);
            logger.info(`[MEMORY MANAGER] Logged tool usage: ${tool} for query="${query}"`, 'AI_MEMORY');
        } catch (err) {
            logger.error(`[MEMORY MANAGER] Failed to log tool usage: ${err.message}`, 'AI_MEMORY');
        }
    }
};
