import { logger } from '../../utils/logger.js';
import { llmClient } from './llmClient.js';

export const responseGenerator = {
    /**
     * Synthesizes the final user-facing response.
     */
    async generateResponse(params, keys = {}) {
        const { userQuery, reasoning, toolResults, plan } = params;

        logger.info(`[RESPONSE GENERATOR] Synthesizing final response for strategy: "${reasoning.response_strategy}"`, 'AI_RESP_GEN');

        const geminiKey = keys.geminiKey || process.env.GEMINI_API_KEY || (process.env.AI_API_KEY?.startsWith('AIzaSy') ? process.env.AI_API_KEY : null);
        const groqKey = keys.groqKey || process.env.GROQ_API_KEY || null;

        // Generate response using LLM (if key is active)
        if (geminiKey || groqKey) {
            try {
                const prompt = `You are VChat, a premium AI Skincare Shopping Assistant for ReviewLens.
Your personality is:
- 50% ChatGPT/Gemini (incredibly human-like, conversational, empathetic, empathetic)
- 25% Expert Skincare Consultant
- 25% Intelligent Shopping Assistant

You must synthesize a natural response based on the REASONING, USER_QUERY, and TOOL_RESULTS.

REASONING STATE (Hidden from user):
${JSON.stringify(reasoning)}

TOOL RESULTS:
${JSON.stringify(toolResults)}

INSTRUCTIONS:
1. Speak naturally. Vary your opening sentences and use empathy. Avoid templates or robotic text.
2. Embed the clinical active ingredients or product details naturally. Mention product prices, ratings, and trust scores whenever relevant.
3. If information is missing (according to reasoning.user_profile), guide the user on providing it.
4. Output response as a JSON object:
{
  "text": "Your markdown formatted conversation response",
  "followUpQuestions": ["List of 3-4 friendly follow-up suggestion strings"]
}
Ensure followUpQuestions contains short, clickable user replies (max 4 words + emoji).
Return ONLY the JSON.

USER QUERY: "${userQuery}"`;

                const jsonText = await llmClient.query({
                    prompt,
                    jsonMode: true,
                    keys
                });

                if (jsonText) {
                    const parsed = JSON.parse(jsonText);
                    
                    return {
                        response: parsed.text,
                        type: this.determineType(reasoning.intent, toolResults),
                        data: toolResults.data || toolResults,
                        followUpQuestions: parsed.followUpQuestions || []
                    };
                }
            } catch (err) {
                logger.error(`[RESPONSE GENERATOR] LLM generation failed: ${err.message}. Triggering offline formatter.`, 'AI_RESP_GEN');
            }
        }

        // Offline Rule-based Formatting Fallback
        return this.localFormatFallback(reasoning.intent, toolResults, reasoning.user_profile);
    },

    determineType(intent, toolResults) {
        if (!toolResults || toolResults.success === false) return 'text';
        if (intent === 'COMPARE') return 'comparison';
        if (intent === 'ROUTINE_BUILDER') return 'routine';
        if (intent === 'INGREDIENT_INFO') return 'ingredient_info';
        if (intent === 'TRUST_ANALYSIS') return 'trust_analysis';
        if (intent === 'PRODUCT_SEARCH' || intent === 'PRODUCT_RECOMMENDATION' || intent === 'PRICE_INQUIRY') return 'product_list';
        return 'text';
    },

    /**
     * Local formatted fallback that matches legacy VChat responses structure
     */
    localFormatFallback(intent, toolResults, userProfile) {
        let text = "";
        let type = 'text';
        let followUpQuestions = [];
        let data = toolResults.data || toolResults;

        const skinStr = userProfile.skin_type ? `your ${userProfile.skin_type} skin` : 'your skin';
        const budgetStr = userProfile.budget ? ` within $${userProfile.budget}` : '';

        if (intent === 'GREETING') {
            text = `🌟 **Hello! I'm VChat, your Clinical AI Shopping Assistant.**\n\nI understand skincare concerns, search products conversationally, compare formulas, and analyze review authenticity.\n\nTell me about your skin or what you're looking for to get personalized recommendations!`;
            type = 'greeting';
            followUpQuestions = [
                'Start Skincare Discovery Flow 🚀',
                'Build me a skincare routine 🌅',
                'Find serums under $30 💰',
                'Explain niacinamide 🧬'
            ];
        } else if (intent === 'INGREDIENT_INFO') {
            if (toolResults.success) {
                const info = toolResults.data || toolResults;
                const d = info.data || info;
                text = `🧬 **Clinical Active: ${d.fullName || info.ingredient}**\n*${d.purpose}*\n\n` +
                       `📊 **Therapeutic Concentration:** ${d.concentration || 'Varies'}\n` +
                       `🎯 **Best Suited For:** ${Array.isArray(d.suitability) ? d.suitability.join(', ') : 'All skin types'}\n\n` +
                       `✅ **Key Benefits:**\n${(d.benefits || []).map(b => `• ${b}`).join('\n')}\n\n` +
                       `⚠️ **Clinical Risks & Side Effects:**\n${(d.risks || []).map(r => `• ${r}`).join('\n')}\n\n` +
                       `🔗 **Formulation Combinations:**\n${d.combos || 'Safe to combine.'}`;
                type = 'ingredient_info';
                followUpQuestions = [`Find products with ${info.ingredient || 'active'} 🔍`, 'What is salicylic acid? 🧬'];
            } else {
                text = `🧪 **Ingredient Profile Unavailable**\n\nI don't have detailed data for that ingredient yet. Ask me about Niacinamide, Retinol, Salicylic Acid, Vitamin C, or Ceramides.`;
                followUpQuestions = ['Explain niacinamide 🧬', 'What does retinol do? 🧪'];
            }
        } else if (intent === 'COMPARE') {
            if (toolResults.success) {
                text = `⚖️ **Product Comparison Summary**\n\n` +
                       `• **Ingredient Quality Winner:** ${toolResults.winners.ingredient}\n` +
                       `• **Review Trust Winner:** ${toolResults.winners.review}\n` +
                       `• **Value Winner:** ${toolResults.winners.value}\n\n` +
                       `🏆 **Overall Winner:** **${toolResults.winners.overall}**\n\n` +
                       `📝 **Clinical Rationale:**\n${toolResults.reasoning}`;
                type = 'comparison';
                followUpQuestions = [
                    `Why is ${toolResults.winner?.title} better? 🤔`,
                    `Analyze reviews for ${toolResults.productA?.title} 🔬`
                ];
            } else {
                text = `⚖️ **Comparison Unavailable**\n\n${toolResults.error || 'I could not compare those products. Try naming two products in the catalog (e.g. Minimalist vs Derma Co).'}`;
                followUpQuestions = ['Search products 🔍', 'Build a skincare routine 🌅'];
            }
        } else if (intent === 'TRUST_ANALYSIS') {
            if (toolResults.success) {
                text = `🔬 **Review Trust Authenticity Scan**\n\n` +
                       `**Overall Status:** ${toolResults.trustLabel}\n` +
                       `**Verified Trust Score:** ${toolResults.avgTrustScore}/100\n` +
                       `**Suspicious Review Rate:** ${toolResults.suspiciousPercentage}%\n\n` +
                       `📋 **Dermatologist Verdict:**\n*${toolResults.recommendation}*`;
                type = 'trust_analysis';
                followUpQuestions = ['Find a more trusted alternative 🚀', 'Compare with other brands ⚖️'];
            } else {
                text = `🔬 **Trust Analysis Unavailable**\n\n${toolResults.error || 'No reviews found for this product.'}`;
                followUpQuestions = ['Search products 🔍'];
            }
        } else if (intent === 'ROUTINE_BUILDER') {
            if (toolResults.success) {
                const formatStep = s => {
                    if (!s.product) return `• **${s.step}**: *(Out of stock)*`;
                    return `• **${s.step}** → **${s.product.title}** ($${s.product.price.toFixed(2)})\n  *${s.product.explanation}*`;
                };
                text = `🌅 **Your Personalized Skincare Routine**\n\n` +
                       `*Scientifically customized for ${skinStr}${budgetStr}*\n\n` +
                       `**☀️ Morning Regimen:**\n` +
                       toolResults.morningRoutine.map(formatStep).join('\n') + '\n\n' +
                       `**🌙 Nighttime Regimen:**\n` +
                       toolResults.eveningRoutine.map(formatStep).join('\n');
                type = 'routine';
                followUpQuestions = ['Why are these selected? 🤔', 'How much does this cost? 💰'];
            } else {
                text = `⚠️ **Routine Builder Offline**\n\nCould not fetch products for routine steps. Try running discovery first.`;
                followUpQuestions = ['Start Skincare Discovery Flow 🚀'];
            }
        } else if (intent === 'PRODUCT_SEARCH' || intent === 'PRODUCT_RECOMMENDATION' || intent === 'PRICE_INQUIRY') {
            if (toolResults.success && toolResults.products.length > 0) {
                text = `✨ **Found ${toolResults.products.length} Products** for ${skinStr}${budgetStr}\n\nHere are the top matches I found in our catalog:`;
                type = 'product_list';
                followUpQuestions = ['Budget Friendly 💰', 'Premium ✨', 'Fragrance Free 🌸'];
            } else {
                text = `🔍 **No Matches Found**\n\nI couldn't find items matching your query. Let's try another search or ask about an active ingredient.`;
                followUpQuestions = ['Search face washes 🧴', 'Explain niacinamide 🧬'];
            }
        } else {
            // General chat response fallback
            text = toolResults.response || toolResults.reply || "🤖 I am processing your query. Please ask me about skincare discovery, routine builds, product comparisons, or review authenticity.";
            followUpQuestions = ['Start Skincare Discovery Flow 🚀', 'Explain salicylic acid 🧬'];
        }

        return {
            response: text,
            type,
            data,
            followUpQuestions,
            timestamp: new Date().toISOString()
        };
    }
};
