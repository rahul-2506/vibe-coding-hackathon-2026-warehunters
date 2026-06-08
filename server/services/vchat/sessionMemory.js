import { logger } from '../../utils/logger.js';

// Thread-safe In-Memory Session Store with TTL/automatic cleaning mechanism
const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes of inactivity
const MAX_HISTORY_LENGTH = 30; // Max messages per chat session to keep context compact

// Periodic cleanup of expired sessions
setInterval(() => {
    const now = Date.now();
    for (const [userId, session] of sessions.entries()) {
        if (now - session.lastAccess > SESSION_TTL) {
            sessions.delete(userId);
            logger.info(`[SessionMemory] Expired inactive session for user: ${userId}`, 'SESSION_MEMORY');
        }
    }
}, 5 * 60 * 1000); // run every 5 minutes

export const sessionMemory = {
    /**
     * Initializes or retrieves a user session.
     */
    get(userId) {
        if (!userId) userId = 'anonymous';
        
        let session = sessions.get(userId);
        if (!session) {
            session = {
                userId,
                chatHistory: [],
                lastProducts: [],
                lastAccess: Date.now()
            };
            sessions.set(userId, session);
        } else {
            session.lastAccess = Date.now();
        }
        
        return session;
    },

    /**
     * Updates/merges context state onto the session.
     */
    update(userId, context) {
        if (!userId) userId = 'anonymous';
        const session = this.get(userId);
        
        if (context && typeof context === 'object') {
            Object.assign(session, context);
            session.lastAccess = Date.now();
            logger.info(`[SessionMemory] Updated session context for user: ${userId}`, 'SESSION_MEMORY');
        }
        return session;
    },

    /**
     * Appends a user message to history and returns the session state.
     */
    learnFromMessage(userId, text) {
        if (!userId) userId = 'anonymous';
        const session = this.get(userId);
        
        session.chatHistory.push({
            role: 'user',
            text: text,
            timestamp: new Date().toISOString()
        });

        // Cap history length
        if (session.chatHistory.length > MAX_HISTORY_LENGTH) {
            session.chatHistory = session.chatHistory.slice(-MAX_HISTORY_LENGTH);
        }

        session.lastAccess = Date.now();
        logger.info(`[SessionMemory] Recorded user message. History count: ${session.chatHistory.length}`, 'SESSION_MEMORY');
        return session;
    },

    /**
     * Records products recently shown to the user in their session for pronoun references.
     */
    recordShownProducts(userId, products) {
        if (!userId) userId = 'anonymous';
        const session = this.get(userId);
        
        if (Array.isArray(products)) {
            // Keep track of the last 10 products shown
            const mapped = products.map(p => ({
                id: p.id,
                title: p.title || p.name
            }));
            
            session.lastProducts = [...(session.lastProducts || []), ...mapped].slice(-10);
            session.lastAccess = Date.now();
            logger.info(`[SessionMemory] Recorded ${products.length} shown products to session for user: ${userId}`, 'SESSION_MEMORY');
        }
        return session;
    },

    /**
     * Appends assistant message to chat history.
     */
    addAssistantMessage(userId, text) {
        if (!userId) userId = 'anonymous';
        const session = this.get(userId);
        
        session.chatHistory.push({
            role: 'assistant',
            text: text,
            timestamp: new Date().toISOString()
        });

        // Cap history length
        if (session.chatHistory.length > MAX_HISTORY_LENGTH) {
            session.chatHistory = session.chatHistory.slice(-MAX_HISTORY_LENGTH);
        }

        session.lastAccess = Date.now();
        logger.info(`[SessionMemory] Recorded assistant message. History count: ${session.chatHistory.length}`, 'SESSION_MEMORY');
        return session;
    },

    /**
     * Resets a session's chat history and product logs.
     */
    reset(userId) {
        if (!userId) userId = 'anonymous';
        sessions.delete(userId);
        logger.info(`[SessionMemory] Reset session for user: ${userId}`, 'SESSION_MEMORY');
        return this.get(userId);
    }
};
