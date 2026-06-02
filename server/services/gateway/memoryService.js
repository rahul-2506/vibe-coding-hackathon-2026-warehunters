import { supabase } from '../../db.js';
import { logger } from '../../utils/logger.js';

export const memoryService = {
    /**
     * Creates a new chat session for a user or a guest.
     * @param {string|null} userId 
     * @returns {Object} Newly created session object
     */
    async createSession(userId = null) {
        try {
            const { data, error } = await supabase
                .from('chat_sessions')
                .insert({ user_id: userId === 'guest' ? null : userId })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (err) {
            logger.error('[MEMORY SERVICE] Failed to create chat session:', err, 'MEMORY');
            // Graceful fallback session representation for offline states
            return { id: 'fallback-session-uuid', user_id: userId, created_at: new Date().toISOString() };
        }
    },

    /**
     * Saves a message to the chat history.
     */
    async saveMessage(sessionId, sender, message, data = null) {
        try {
            const { error } = await supabase
                .from('chat_messages')
                .insert({
                    session_id: sessionId === 'fallback-session-uuid' ? null : sessionId,
                    sender,
                    message,
                    data: data ? JSON.stringify(data) : null
                });

            if (error) throw error;
            return true;
        } catch (err) {
            logger.error('[MEMORY SERVICE] Failed to save chat message:', err, 'MEMORY');
            return false;
        }
    },

    /**
     * Retrieves messages for a session.
     */
    async getSessionMessages(sessionId) {
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data.map(m => ({
                id: m.id,
                sender: m.sender,
                message: m.message,
                data: m.data ? JSON.parse(m.data) : null,
                created_at: m.created_at
            }));
        } catch (err) {
            logger.error(`[MEMORY SERVICE] Failed to fetch session messages for session ${sessionId}:`, err, 'MEMORY');
            return [];
        }
    },

    /**
     * Saves user profile preferences.
     */
    async saveUserPreferences(userId, preferences) {
        if (!userId || userId === 'guest') return null;
        try {
            const { data, error } = await supabase
                .from('user_preferences')
                .upsert({
                    user_id: userId,
                    skin_type: preferences.skinType,
                    budget: preferences.budget,
                    concerns: preferences.concerns,
                    disliked_ingredients: preferences.dislikedIngredients,
                    preferred_brands: preferences.preferredBrands,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            // Also update the core profile sync table if available
            await supabase
                .from('profiles')
                .update({
                    skin_type: preferences.skinType || 'normal',
                    max_budget: preferences.budget || 1500,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            return data;
        } catch (err) {
            logger.error(`[MEMORY SERVICE] Failed to save user preferences for user ${userId}:`, err, 'MEMORY');
            return null;
        }
    },

    /**
     * Retrieves user preferences.
     */
    async getUserPreferences(userId) {
        if (!userId || userId === 'guest') return null;
        try {
            const { data, error } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            if (!data) return null;

            return {
                skinType: data.skin_type,
                budget: Number(data.budget),
                concerns: data.concerns || [],
                dislikedIngredients: data.disliked_ingredients || [],
                preferredBrands: data.preferred_brands || []
            };
        } catch (err) {
            logger.error(`[MEMORY SERVICE] Failed to load user preferences for user ${userId}:`, err, 'MEMORY');
            return null;
        }
    },

    /**
     * Records a product interest interaction log.
     */
    async recordProductInterest(userId, productId) {
        if (!userId || userId === 'guest') return;
        try {
            // Read existing preferences to append interest
            const { data: pref, error } = await supabase
                .from('user_preferences')
                .select('product_interests')
                .eq('user_id', userId)
                .single();

            let interests = [];
            if (!error && pref && pref.product_interests) {
                interests = Array.isArray(pref.product_interests) ? pref.product_interests : JSON.parse(pref.product_interests);
            }

            // Limit list size to top 20 recent interests
            const updatedInterests = [...new Set([Number(productId), ...interests])].slice(0, 20);

            await supabase
                .from('user_preferences')
                .upsert({
                    user_id: userId,
                    product_interests: updatedInterests,
                    updated_at: new Date().toISOString()
                });
        } catch (err) {
            logger.error(`[MEMORY SERVICE] Failed to record product interest for user ${userId}:`, err, 'MEMORY');
        }
    }
};
