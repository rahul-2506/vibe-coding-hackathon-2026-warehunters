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
4. Formatting Structure: You MUST format your response ("text" key) strictly using the following Markdown headers and section layout (do NOT indent these lines with spaces):

### Introduction
[Brief overview of the topic or problem]

### Main Discussion
[Detailed explanation, features, analysis, or conversation content]

### Point 1
[First major point or explanation]

### Point 2
[Second major point or explanation]

### Example / Demonstration
[Optional examples or scenarios, omit this section if not relevant]

### Conclusion
[Final summary, recommendation, or closing statement]

5. Output response as a JSON object:
{
  "text": "Your markdown formatted conversation response conforming to the structure above",
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
                        response: this.cleanResponseText(parsed.text),
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

    cleanResponseText(text) {
        if (!text) return '';
        let cleaned = text.trim();
        
        // 1. Strip markdown code fences if LLM wrapped the text in them
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```json?\s*/i, '').replace(/^```markdown?\s*/i, '').replace(/```$/, '').trim();
        }
        
        // 2. If every line starts with 4 spaces (indented code block copy), strip the leading spaces
        const lines = cleaned.split('\n');
        const hasUniversalIndent = lines.every(line => line.trim() === '' || line.startsWith('    ') || line.startsWith('\t'));
        if (hasUniversalIndent && lines.some(line => line.trim() !== '')) {
            cleaned = lines.map(line => line.startsWith('    ') ? line.substring(4) : (line.startsWith('\t') ? line.substring(1) : line)).join('\n');
        }
        
        return cleaned.trim();
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
            text = `### Introduction\n` +
                   `Welcome! I am V-CHAT, your clinical skincare intelligence assistant.\n\n` +
                   `### Main Discussion\n` +
                   `I can help you build custom skincare routines, run discovery searches, compare brand formulas side-by-side, or analyze review trust indexes.\n\n` +
                   `### Point 1\n` +
                   `**Skin Profile Customization:**\n` +
                   `By learning about your skin type, concerns, and budget preferences, I select highly bio-relevant ingredients for optimal results.\n\n` +
                   `### Point 2\n` +
                   `**Authenticity Audit:**\n` +
                   `My neural classifier inspects review datasets to flag suspicious or fraudulent customer feedback.\n\n` +
                   `### Conclusion\n` +
                   `Let me know how your skin is feeling today, or select one of the quick suggestions below to begin!`;
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
                text = `### Introduction\n` +
                       `A detailed scientific analysis of the active skincare compound **${d.fullName || info.ingredient}**.\n\n` +
                       `### Main Discussion\n` +
                       `**${d.fullName || info.ingredient}** serves a clinical purpose as a *${d.purpose}*.\n\n` +
                       `### Point 1\n` +
                       `**Therapeutic Concentration & Skin Suitability:**\n` +
                       `This compound is typically formulated at a concentration of ${d.concentration || 'Varies'}. It is best suited for: ${Array.isArray(d.suitability) ? d.suitability.join(', ') : 'All skin types'}.\n\n` +
                       `### Point 2\n` +
                       `**Clinical Benefits & Risks:**\n` +
                       `*Key Benefits:*\n${(d.benefits || []).map(b => `• ${b}`).join('\n')}\n\n` +
                       `*Clinical Risks & Side Effects:*\n${(d.risks || []).map(r => `• ${r}`).join('\n')}\n\n` +
                       `### Example / Demonstration\n` +
                       `**Formulation Synergy:**\n${d.combos || 'Safe to combine.'}\n\n` +
                       `### Conclusion\n` +
                       `When introducing **${d.fullName || info.ingredient}** to your routine, begin slowly to test your skin barrier tolerance and pair with active sunscreen protection.`;
                type = 'ingredient_info';
                followUpQuestions = [`Find products with ${info.ingredient || 'active'} 🔍`, 'What is salicylic acid? 🧬'];
            } else {
                text = `### Introduction\n` +
                       `Ingredient profile search initiated.\n\n` +
                       `### Main Discussion\n` +
                       `Scientific data for that specific active is currently unavailable in the offline cache.\n\n` +
                       `### Point 1\n` +
                       `**Supported Actives:**\n` +
                       `Please ask about Niacinamide, Retinol, Salicylic Acid, Vitamin C, or Ceramides.\n\n` +
                       `### Conclusion\n` +
                       `I can explain standard clinical functions of these ingredients. Let me know what you want to learn.`;
                followUpQuestions = ['Explain niacinamide 🧬', 'What does retinol do? 🧪'];
            }
        } else if (intent === 'COMPARE') {
            if (toolResults.success) {
                text = `### Introduction\n` +
                       `A side-by-side comparison of target products to evaluate formula efficacy and review authenticity.\n\n` +
                       `### Main Discussion\n` +
                       `We compared the key dimensions including ingredient quality, review trust ratings, and relative value.\n\n` +
                       `### Point 1\n` +
                       `**Winner Breakdown:**\n` +
                       `• **Ingredient Quality Winner:** ${toolResults.winners.ingredient}\n` +
                       `• **Review Trust Winner:** ${toolResults.winners.review}\n` +
                       `• **Value Winner:** ${toolResults.winners.value}\n\n` +
                       `### Point 2\n` +
                       `**Overall Recommendation Winner:**\n` +
                       `🏆 **Overall Winner:** **${toolResults.winners.overall}**\n\n` +
                       `### Example / Demonstration\n` +
                       `**Clinical Rationale:**\n${toolResults.reasoning}\n\n` +
                       `### Conclusion\n` +
                       `Based on this comparison, we highly recommend choosing the winner for optimal dermatological results.`;
                type = 'comparison';
                followUpQuestions = [
                    `Why is ${toolResults.winner?.title} better? 🤔`,
                    `Analyze reviews for ${toolResults.productA?.title} 🔬`
                ];
            } else {
                text = `### Introduction\n` +
                       `Product comparison initiated.\n\n` +
                       `### Main Discussion\n` +
                       `I could not compare those products side-by-side because one or both names could not be found.\n\n` +
                       `### Point 1\n` +
                       `**Offline Comparison Checklist:**\n` +
                       `Ensure you have named two products currently present in the active catalog.\n\n` +
                       `### Conclusion\n` +
                       `Try search phrases like 'Compare Minimalist vs Derma Co' or type search to find products.`;
                followUpQuestions = ['Search products 🔍', 'Build a skincare routine 🌅'];
            }
        } else if (intent === 'TRUST_ANALYSIS') {
            if (toolResults.success) {
                text = `### Introduction\n` +
                       `An analysis of the review authenticity index for the selected product.\n\n` +
                       `### Main Discussion\n` +
                       `We evaluated the distribution and duplicate matches among the user-submitted reviews.\n\n` +
                       `### Point 1\n` +
                       `**Integrity Metrics:**\n` +
                       `• **Overall Status:** ${toolResults.trustLabel}\n` +
                       `• **Verified Trust Score:** ${toolResults.avgTrustScore}/100\n\n` +
                       `### Point 2\n` +
                       `**Authenticity Vulnerabilities:**\n` +
                       `• **Suspicious Review Rate:** ${toolResults.suspiciousPercentage}%\n\n` +
                       `### Conclusion\n` +
                       `**Dermatologist Verdict:**\n*${toolResults.recommendation}*`;
                type = 'trust_analysis';
                followUpQuestions = ['Find a more trusted alternative 🚀', 'Compare with other brands ⚖️'];
            } else {
                text = `### Introduction\n` +
                       `Review authenticity analysis initiated.\n\n` +
                       `### Main Discussion\n` +
                       `No active review dataset was found for this specific product.\n\n` +
                       `### Conclusion\n` +
                       `Please verify the product name or try searching for another item in our skincare catalog.`;
                followUpQuestions = ['Search products 🔍'];
            }
        } else if (intent === 'ROUTINE_BUILDER') {
            if (toolResults.success) {
                const formatStep = s => {
                    if (!s.product) return `• **${s.step}**: *(Out of stock)*`;
                    return `• **${s.step}** → **${s.product.title}** ($${s.product.price.toFixed(2)})\n  *${s.product.explanation}*`;
                };
                text = `### Introduction\n` +
                       `Your personalized skincare routine, scientifically customized for ${skinStr}${budgetStr}.\n\n` +
                       `### Main Discussion\n` +
                       `Detailed step-by-step clinical routine divided into morning and evening phases.\n\n` +
                       `### Point 1\n` +
                       `**☀️ Morning Regimen:**\n` +
                       toolResults.morningRoutine.map(formatStep).join('\n') + '\n\n' +
                       `### Point 2\n` +
                       `**🌙 Nighttime Regimen:**\n` +
                       toolResults.eveningRoutine.map(formatStep).join('\n') + '\n\n' +
                       `### Conclusion\n` +
                       `Consistency is key to rebuilding your skin barrier. Always apply sunscreen in the morning when using active treatments.`;
                type = 'routine';
                followUpQuestions = ['Why are these selected? 🤔', 'How much does this cost? 💰'];
            } else {
                text = `### Introduction\n` +
                       `Routine builder requested.\n\n` +
                       `### Main Discussion\n` +
                       `Could not fetch the product inventory required to build your routine steps.\n\n` +
                       `### Conclusion\n` +
                       `Please verify database connections or start the skincare discovery flow to load catalog items.`;
                followUpQuestions = ['Start Skincare Discovery Flow 🚀'];
            }
        } else if (intent === 'PRODUCT_SEARCH' || intent === 'PRODUCT_RECOMMENDATION' || intent === 'PRICE_INQUIRY') {
            if (toolResults.success && toolResults.products.length > 0) {
                text = `### Introduction\n` +
                       `We searched our active inventory to find product matches suitable for ${skinStr}${budgetStr}.\n\n` +
                       `### Main Discussion\n` +
                       `Here are the top matches I found in our catalog:\n\n` +
                       `### Point 1\n` +
                       `**Found ${toolResults.products.length} Products:**\n` +
                       `Matches are selected based on skin suitability, active concerns, and budget parameters.\n\n` +
                       `### Point 2\n` +
                       `**Visual Table Comparison:**\n` +
                       `Please refer to the interactive table below to compare these items side-by-side or inspect details.\n\n` +
                       `### Conclusion\n` +
                       `Select a product from the list to analyze its review trust authenticity, compare brands, or view catalog details.`;
                type = 'product_list';
                followUpQuestions = ['Budget Friendly 💰', 'Premium ✨', 'Fragrance Free 🌸'];
            } else {
                text = `### Introduction\n` +
                       `Product catalog search initiated.\n\n` +
                       `### Main Discussion\n` +
                       `No matching products were found in our active database matching those criteria.\n\n` +
                       `### Conclusion\n` +
                       `Try typing other search parameters (e.g. Cleanser or Face Wash) or explore scientific compounds.`;
                followUpQuestions = ['Search face washes 🧴', 'Explain niacinamide 🧬'];
            }
        } else {
            // General chat response fallback
            text = `### Introduction\n` +
                   `VChat skincare consultant assistant online.\n\n` +
                   `### Main Discussion\n` +
                   `Regarding your skincare query:\n` +
                   (toolResults.response || toolResults.reply || "I am processing your query. Please ask me about skincare discovery, routine builds, product comparisons, or review authenticity.") + `\n\n` +
                   `### Point 1\n` +
                   `We analyze product formulas using dermatological principles.\n\n` +
                   `### Point 2\n` +
                   `Review metrics are processed by our machine learning Naive Bayes classifier.\n\n` +
                   `### Conclusion\n` +
                   `Let me know if you would like to rebuild your daily routine or analyze reviews.`;
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
