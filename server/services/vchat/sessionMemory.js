/**
 * VChat Session Memory
 * Lightweight in-memory session store keyed by userId.
 * Stores: skin type, budget, concerns, sensitivities, experience level, previous products shown.
 * Equipped with a stateful state-machine for Guided Discovery Flows.
 */

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

const sessions = new Map();

function getOrCreate(userId) {
    const now = Date.now();
    let session = sessions.get(userId);

    if (!session || (now - session.updatedAt) > SESSION_TTL_MS) {
        session = {
            userId,
            skinType: null,            // 'oily' | 'dry' | 'combination' | 'normal' | 'sensitive'
            budget: null,              // number (max price in USD)
            concerns: [],              // e.g. ['acne', 'dark spots', 'anti-aging']
            preferredCategories: [],   // e.g. ['Skincare & Beauty']
            preferredBrands: [],       // e.g. ['Luminis', 'DermaGlow', 'Mamaearth']
            dislikedIngredients: [],   // e.g. ['fragrance', 'alcohol']
            lastProducts: [],          // Array of { id, title, price } shown recently
            experience: null,          // 'beginner' | 'experienced'
            sensitivities: null,       // e.g. 'none', 'salicylic acid'
            discoveryStep: null,       // null | 1 | 2 | 3 | 4 | 5 (guided discovery state machine)
            lastSearchQuery: null,     // stored to allow follow-up conversational search refinement
            messageCount: 0,
            chatHistory: [],           // Conversation memory
            createdAt: now,
            updatedAt: now,
        };
        sessions.set(userId, session);
    }

    return session;
}

function update(userId, updates) {
    const session = getOrCreate(userId);
    Object.assign(session, updates, { updatedAt: Date.now() });
    sessions.set(userId, session);
    return session;
}

// ─────────────────────────────────────────────
// PARSING & TEXT EXTRACTION LOGIC
// ─────────────────────────────────────────────
function extractContextFromMessage(message) {
    const lower = message.toLowerCase();
    const extracted = {};

    // 1. Skin type detection
    if (/oily\s+skin|my\s+skin\s+(is\s+)?oily|oily/i.test(lower)) extracted.skinType = 'oily';
    else if (/dry\s+skin|my\s+skin\s+(is\s+)?dry|dry/i.test(lower)) extracted.skinType = 'dry';
    else if (/combination\s+skin|combo\s+skin|combo|combination/i.test(lower)) extracted.skinType = 'combination';
    else if (/sensitiv(e)?\s+skin|sensitive/i.test(lower)) extracted.skinType = 'sensitive';
    else if (/normal\s+skin|normal/i.test(lower)) extracted.skinType = 'normal';

    // 2. Budget detection
    const budgetMatch = lower.match(/(?:under|below|budget\s+of|max|around)\s+(?:rs\.?\s*|₹|\$)?(\d+)/i) || 
                        lower.match(/(\d+)\s*(?:budget|max)/i);
    if (budgetMatch) {
        const amount = parseInt(budgetMatch[1]);
        if (!isNaN(amount) && amount > 0) extracted.budget = amount;
    }

    // 3. Concern detection  
    const concernMap = {
        'acne': ['acne', 'pimple', 'breakout', 'blemish', 'whitehead', 'blackhead'],
        'dark spots': ['dark spot', 'hyperpigment', 'melasma', 'spot', 'brightening'],
        'anti-aging': ['wrinkle', 'fine line', 'aging', 'anti-age', 'firming'],
        'dryness': ['dryness', 'dry', 'dehydrated', 'flaky'],
        'oiliness': ['oily', 'excess oil', 'sebum', 'pores'],
        'sensitivity': ['sensitive', 'redness', 'rosacea', 'irritation'],
        'dark circles': ['dark circle', 'under eye', 'eye gel'],
        'large pores': ['pore', 'enlarged pore', 'open pore'],
    };

    const newConcerns = [];
    for (const [concern, triggers] of Object.entries(concernMap)) {
        if (triggers.some(t => lower.includes(t))) {
            newConcerns.push(concern);
        }
    }

    if (newConcerns.length > 0) {
        extracted.concerns = newConcerns;
    }

    // 4. Actives Experience detection
    if (/beginner|newbie|start|novice/i.test(lower)) {
        extracted.experience = 'beginner';
    } else if (/experienced|pro|expert|actives/i.test(lower)) {
        extracted.experience = 'experienced';
    }

    // 5. Sensitivity detection
    if (/sensitivity|sensitivities|allerg(y|ies)/i.test(lower)) {
        if (lower.includes('fragrance')) extracted.dislikedIngredients = ['fragrance'];
        if (lower.includes('alcohol')) extracted.dislikedIngredients = ['alcohol'];
    }

    // 6. Brand Preferences detection
    const brands = ['luminis', 'dermaglow', 'aura botanicals', 'mamaearth', 'himalaya', 'derma co'];
    const matchedBrands = brands.filter(b => lower.includes(b));
    if (matchedBrands.length > 0) {
        extracted.preferredBrands = matchedBrands;
    }

    return extracted;
}

export const sessionMemory = {
    get(userId) {
        return getOrCreate(userId);
    },

    update(userId, updates) {
        return update(userId, updates);
    },

    /**
     * Resets the entire session preferences.
     */
    reset(userId) {
        sessions.delete(userId);
        return getOrCreate(userId);
    },

    /**
     * Appends assistant message to chat history.
     */
    addAssistantMessage(userId, message) {
        const session = getOrCreate(userId);
        session.chatHistory = session.chatHistory || [];
        session.chatHistory.push({ role: 'assistant', text: message });
        if (session.chatHistory.length > 10) {
            session.chatHistory.shift();
        }
        return update(userId, { chatHistory: session.chatHistory });
    },

    /**
     * Stateful Guided Discovery State Machine.
     * Intercepts messages if the user is in the middle of answering profile discovery questions.
     * Returns a response payload if it processes a step, else null.
     */
    handleGuidedDiscovery(userId, message) {
        const session = getOrCreate(userId);
        if (session.discoveryStep === null) return null;

        const lower = message.toLowerCase().trim();
        let nextText = '';
        let followUpQuestions = [];
        let type = 'guided_discovery';

        switch (session.discoveryStep) {
            case 1: // User answering: "What is your skin type?"
                if (/oily/i.test(lower)) session.skinType = 'oily';
                else if (/dry/i.test(lower)) session.skinType = 'dry';
                else if (/combo|combination/i.test(lower)) session.skinType = 'combination';
                else if (/sensitive/i.test(lower)) session.skinType = 'sensitive';
                else session.skinType = 'normal';

                session.discoveryStep = 2;
                nextText = `📝 **Step 2/5: Skin Concerns**\n\nGot it, your skin type is **${(session.skinType || 'normal').toUpperCase()}**.\n\nWhat is your primary skincare concern? (acne, dark spots, wrinkles, dryness, none)`;
                followUpQuestions = ['Acne and breakouts 💊', 'Dark spots and tanning ☀️', 'Wrinkles and fine lines ⏳', 'General hydration 💧'];
                break;

            case 2: // User answering: "What concerns do you have?"
                const parsed = extractContextFromMessage(message);
                session.concerns = parsed.concerns || [message];
                session.discoveryStep = 3;
                nextText = `📝 **Step 3/5: Budget Preference**\n\nUnderstood, we are targeting: **${session.concerns.join(', ')}**.\n\nWhat is your maximum budget in dollars? (e.g. under $30, $50, no limit)`;
                followUpQuestions = ['Under $20 💰', 'Under $40 💳', 'Under $100 💎', 'No budget limit 🌐'];
                break;

            case 3: // User answering: "Budget?"
                const amtMatch = lower.match(/\d+/);
                if (amtMatch) {
                    session.budget = parseInt(amtMatch[0]);
                } else if (/no\s*limit|unlimited/i.test(lower)) {
                    session.budget = 999;
                } else {
                    session.budget = 50; // default fallback
                }

                session.discoveryStep = 4;
                nextText = `📝 **Step 4/5: Experience with Actives**\n\nSet budget to: **${session.budget === 999 ? 'No limit' : `$${session.budget}`}**.\n\nAre you a beginner or experienced with chemical active ingredients (like retinol, salicylic acid)?`;
                followUpQuestions = ['I am a beginner 🐣', 'I am experienced 🧪'];
                break;

            case 4: // User answering: "Beginner or experienced?"
                if (/experienced|pro|active/i.test(lower)) {
                    session.experience = 'experienced';
                } else {
                    session.experience = 'beginner';
                }

                session.discoveryStep = 5;
                nextText = `📝 **Step 5/5: Ingredient Sensitivities**\n\nSaved experience level: **${(session.experience || 'beginner').toUpperCase()}**.\n\nDo you have any known ingredient sensitivities or allergies? (e.g. fragrance, alcohol, salicylic acid, none)`;
                followUpQuestions = ['Sensitive to fragrance 🌸', 'Sensitive to alcohol 🧪', 'No sensitivities / None ✅'];
                break;

            case 5: // User answering: "Sensitivities?"
                if (/fragrance/i.test(lower)) {
                    session.dislikedIngredients = ['fragrance'];
                    session.sensitivities = 'fragrance';
                } else if (/alcohol/i.test(lower)) {
                    session.dislikedIngredients = ['alcohol'];
                    session.sensitivities = 'alcohol';
                } else if (/none|no/i.test(lower)) {
                    session.sensitivities = 'none';
                } else {
                    session.sensitivities = message;
                }

                session.discoveryStep = null; // Completed!
                nextText = `🎉 **Discovery Complete!**\n\nI have locked in your skincare profile:\n` +
                    `• **Skin Type:** ${(session.skinType || 'normal').toUpperCase()}\n` +
                    `• **Concerns:** ${session.concerns.join(', ')}\n` +
                    `• **Budget:** ${session.budget === 999 ? 'Unlimited' : `$${session.budget}`}\n` +
                    `• **Actives Experience:** ${(session.experience || 'beginner').toUpperCase()}\n` +
                    `• **Sensitivities:** ${session.sensitivities}\n\n` +
                    `Based on your details, I am building custom product suggestions for you immediately!`;
                
                type = 'discovery_completed';
                followUpQuestions = ['Recommend products now! 🚀', 'Build me a full routine 🌅'];
                break;
        }

        update(session.userId, session);

        return {
            response: nextText,
            type,
            data: {
                skinType: session.skinType,
                concerns: session.concerns,
                budget: session.budget,
                experience: session.experience,
                sensitivities: session.sensitivities,
                discoveryStep: session.discoveryStep
            },
            followUpQuestions,
            timestamp: new Date().toISOString()
        };
    },

    /**
     * Parses a user message to extract contextual hints and updates the session.
     */
    learnFromMessage(userId, message) {
        const session = getOrCreate(userId);
        session.messageCount++;
        session.updatedAt = Date.now();

        // Avoid learning from message during guided state machine to prevent parsing errors
        if (session.discoveryStep !== null) return session;

        // Append user query to chat history
        session.chatHistory = session.chatHistory || [];
        session.chatHistory.push({ role: 'user', text: message });
        if (session.chatHistory.length > 10) {
            session.chatHistory.shift();
        }

        const extracted = extractContextFromMessage(message);

        // Merge concerns (additive)
        if (extracted.concerns && extracted.concerns.length > 0) {
            const existing = new Set(session.concerns);
            for (const c of extracted.concerns) existing.add(c);
            extracted.concerns = [...existing];
        }

        // Store last searched categories to enable conversational refinements
        const catMatch = message.match(/moisturizer|sunscreen|cleanser|serum|toner|facewash/i);
        if (catMatch) {
            session.lastSearchQuery = catMatch[0].toLowerCase();
        }

        return update(userId, extracted);
    },

    /**
     * Records products shown to the user to prevent repetition.
     */
    recordShownProducts(userId, products) {
        const session = getOrCreate(userId);
        const newEntries = (products || []).slice(0, 5).map(p => ({
            id: p.id,
            title: p.title || p.name,
            price: p.price,
        }));
        const combined = [...session.lastProducts, ...newEntries];
        // Keep only the last 20
        update(userId, { lastProducts: combined.slice(-20) });
    },

    /**
     * Returns a context summary string for injection into AI prompts.
     */
    getContextSummary(userId) {
        const session = getOrCreate(userId);
        const parts = [];

        if (session.skinType) parts.push(`User's skin type: ${session.skinType}`);
        if (session.budget) parts.push(`Budget preference: under $${session.budget}`);
        if (session.concerns.length > 0) parts.push(`Skin concerns: ${session.concerns.join(', ')}`);
        if (session.dislikedIngredients.length > 0) parts.push(`Avoid ingredients: ${session.dislikedIngredients.join(', ')}`);
        if (session.lastProducts.length > 0) {
            const recentNames = session.lastProducts.slice(-5).map(p => p.title).join(', ');
            parts.push(`Recently discussed products: ${recentNames}`);
        }

        return parts.length > 0 ? parts.join('. ') + '.' : '';
    },

    /**
     * Cleans up expired sessions (call periodically if needed).
     */
    cleanup() {
        const now = Date.now();
        for (const [key, session] of sessions.entries()) {
            if ((now - session.updatedAt) > SESSION_TTL_MS) {
                sessions.delete(key);
            }
        }
    }
};

// Periodic cleanup every 15 minutes
setInterval(() => sessionMemory.cleanup(), 15 * 60 * 1000);
