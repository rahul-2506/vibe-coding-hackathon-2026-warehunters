/**
 * VChat Response Formatter
 * Converts raw tool outputs into polished, structured response objects
 * that include both the text response and rich data for the frontend.
 */

import { logger } from '../../utils/logger.js';

/**
 * Build a rich response object that the frontend will use to render
 * text + optional UI blocks (product cards, comparison table, etc.)
 */
export function buildResponse({ text, type = 'text', data = null, followUpQuestions = [] }) {
    return {
        response: text,
        type,
        data,
        followUpQuestions,
        timestamp: new Date().toISOString(),
    };
}

// ─────────────────────────────────────────────
// Formatter: Product Search Results
// ─────────────────────────────────────────────
export function formatSearchResults(toolResult, userSession) {
    const { products, total } = toolResult;

    if (!products || products.length === 0) {
        const text = `🔍 **No Products Found**\n\nI couldn't find products matching your query in our catalog. Try searching for something like "moisturizer", "serum", or "cleanser".`;
        return buildResponse({
            text,
            type: 'text',
            followUpQuestions: [
                'Show me all skincare products 🧴',
                'What\'s good for dry skin? 💧',
                'Find affordable serums 💰',
            ]
        });
    }

    const contextLines = [];
    if (userSession.skinType) contextLines.push(`your ${userSession.skinType} skin`);
    if (userSession.concerns && userSession.concerns.length > 0) contextLines.push(userSession.concerns.join(', '));
    if (userSession.budget) contextLines.push(`under $${userSession.budget}`);
    const contextStr = contextLines.length > 0 ? ` personalized for ${contextLines.join(' and ')}` : '';

    const text = `✨ **Found ${total} Product${total !== 1 ? 's' : ''}**${contextStr}\n\nHere are the top picks I recommend, ranked by trust score. Click **"Why this recommendation?"** on any card to see how it matches your profile!`;

    // Dynamic follow-up filters (Phase 6 refinements)
    return buildResponse({
        text,
        type: 'product_list',
        data: { products },
        followUpQuestions: [
            'Budget Friendly 💰',
            'Premium ✨',
            'Fragrance Free 🌸',
            'Sensitive Skin 🛡️',
            'Oily Skin 💧',
            'Dry Skin ❄️',
        ]
    });
}

// ─────────────────────────────────────────────
// Formatter: Product Comparison
// ─────────────────────────────────────────────
export function formatComparisonResult(toolResult, aiAnalysis) {
    const { productA, productB, sharedKeywords, winner, winners, reasoning } = toolResult;

    if (!toolResult.success) {
        const text = `⚠️ **Comparison Failed**\n\nI couldn't find both products for comparison. Could you give me more specific product names?\n\n*Tip: Try "Compare Luminis Hydrating Serum with DermaGlow Clarifying Serum"*`;
        return buildResponse({
            text,
            type: 'text',
            followUpQuestions: ['Show me all serums 🧴', 'Build me a routine 🌅']
        });
    }

    const text = `⚖️ **Product Comparison Summary**\n\n` +
        `• **Ingredient Quality Winner:** ${winners.ingredient}\n` +
        `• **Review Trust Winner:** ${winners.review}\n` +
        `• **Value Winner:** ${winners.value}\n\n` +
        `🏆 **Overall Winner:** **${winners.overall}**\n\n` +
        `📝 **Clinical Rationale:**\n${reasoning || aiAnalysis}`;

    return buildResponse({
        text,
        type: 'comparison',
        data: { productA, productB, sharedKeywords, winner, winners, reasoning },
        followUpQuestions: [
            `Why is ${winner?.title} better? 🤔`,
            `Analyze reviews for ${productA?.title} 🔬`,
            `Analyze reviews for ${productB?.title} 🔬`,
        ]
    });
}

// ─────────────────────────────────────────────
// Formatter: Trust Analysis (fraud scorecard)
// ─────────────────────────────────────────────
export function formatTrustAnalysis(toolResult) {
    if (!toolResult.success) {
        const text = `⚠️ **Trust Analysis Unavailable**\n\n${toolResult.error || 'Could not find reviews for this product.'}`;
        return buildResponse({ text, type: 'text' });
    }

    const { 
        totalReviews, genuineCount, fakeCount, avgTrustScore, 
        suspiciousPercentage, duplicateCount, sentimentMismatchCount,
        trustLabel, recommendation, topGenuine, topSuspicious 
    } = toolResult;

    const text = `🔬 **Review Trust Authenticity Scan**\n\n` +
        `**Overall Status:** ${trustLabel === 'Highly Trusted' ? '🟢 Highly Trusted' : trustLabel === 'Moderately Trusted' ? '🟡 Moderately Trusted' : '🔴 Low Trust Score'}\n` +
        `**Verified Trust Score:** ${avgTrustScore}/100\n` +
        `**Suspicious Review Rate:** ${suspiciousPercentage}%\n` +
        `**Total Submissions Checked:** ${totalReviews}\n\n` +
        `🛡️ **Fraud Signatures Detected:**\n` +
        `• **Duplicate Text Postings:** ${duplicateCount} signature${duplicateCount !== 1 ? 's' : ''} flagged\n` +
        `• **Contradictory Sentiment Mismatches:** ${sentimentMismatchCount} review${sentimentMismatchCount !== 1 ? 's' : ''} flagged\n\n` +
        `📋 **Dermatologist Verdict:**\n*${recommendation}*\n\n` +
        (topGenuine.length > 0
            ? `💬 **Verified Genuine Sample:**\n> "${topGenuine[0].text}..." *(Score: ${topGenuine[0].trust_score}% - ${topGenuine[0].reviewer})*\n\n`
            : '') +
        (topSuspicious.length > 0 && fakeCount > 0
            ? `⚠️ **Suspicious Marker Sample:**\n> "${topSuspicious[0].text}..." *(Score: ${topSuspicious[0].trust_score}% - ${topSuspicious[0].reviewer})*\n`
            : '');

    return buildResponse({
        text,
        type: 'trust_analysis',
        data: toolResult,
        followUpQuestions: [
            'What flags duplicate reviews? 🛡️',
            'Find a more trusted alternative 🚀',
            'Compare with other brands ⚖️',
        ]
    });
}

// ─────────────────────────────────────────────
// Formatter: Ingredient Info
// ─────────────────────────────────────────────
export function formatIngredientInfo(toolResult) {
    if (!toolResult.success) {
        const text = `🧪 **Ingredient Not Found**\n\nI don't have detailed data for "${toolResult.ingredient}" yet. Here are ingredients I can explain in detail:\n\n- Niacinamide, Retinol, Hyaluronic Acid\n- Salicylic Acid, Glycolic Acid, Azelaic Acid\n- Vitamin C, Ceramides`;
        return buildResponse({
            text,
            type: 'text',
            followUpQuestions: ['Tell me about niacinamide 🧬', 'What does retinol do? 🧪', 'Explain hyaluronic acid 💧']
        });
    }

    const { ingredient, data, dbInsight } = toolResult;
    const { fullName, purpose, benefits, risks, suitability, concentration, combos } = data;

    const text = `🧬 **Clinical Active: ${fullName}**\n` +
        `*${purpose}*\n\n` +
        `📊 **Therapeutic Concentration:** ${concentration}\n` +
        `🎯 **Best Suited For:** ${suitability.join(', ')}\n\n` +
        `✅ **Key Benefits:**\n${benefits.map(b => `• ${b}`).join('\n')}\n\n` +
        `⚠️ **Clinical Risks & Side Effects:**\n${risks.map(r => `• ${r}`).join('\n')}\n\n` +
        `🔗 **Formulation Combinations:**\n${combos}\n` +
        (dbInsight ? `\n📖 **Additional Clinical Knowledge:**\n*${dbInsight}*` : '');

    return buildResponse({
        text,
        type: 'ingredient_info',
        data: { ingredient, ...data },
        followUpQuestions: [
            `Find products with ${ingredient} 🔍`,
            'What other actives fight acne? 💊',
            'Can I use this daily? 🗓️',
        ]
    });
}

// ─────────────────────────────────────────────
// Formatter: Routine Builder
// ─────────────────────────────────────────────
export function formatRoutine(toolResult) {
    if (!toolResult.success) {
        const text = `⚠️ **Routine Builder Failed**\n\nI had trouble finding products for all steps. ${toolResult.error || ''}`;
        return buildResponse({ text, type: 'text' });
    }

    const { skinType, concerns, morningRoutine, eveningRoutine } = toolResult;
    const concernStr = concerns.length > 0 ? ` targeting ${concerns.join(', ')}` : '';

    const formatStep = s => {
        if (!s.product) return `• **${s.step}**: *(Product currently unavailable in inventory)*`;
        return `• **${s.step}** → **${s.product.title}** ($${s.product.price.toFixed(2)} - Authenticity Score: ${s.product.trust_score}%)\n` +
               `  *Explanation: ${s.product.explanation}*`;
    };

    const text = `🌅 **Your Personalized Skincare Routine**\n\n` +
        `*Scientifically customized for your **${skinType.toUpperCase()}** skin${concernStr}*\n\n` +
        `**☀️ Morning Regimen:**\n` +
        morningRoutine.map(formatStep).join('\n') +
        `\n\n` +
        `**🌙 Nighttime Regimen:**\n` +
        eveningRoutine.map(formatStep).join('\n');

    return buildResponse({
        text,
        type: 'routine',
        data: { skinType, concerns, morningRoutine, eveningRoutine },
        followUpQuestions: [
            'Why are these selected? 🤔',
            'How much does the whole routine cost? 💰',
            'What order do I apply these? 🧴',
        ]
    });
}

// ─────────────────────────────────────────────
// Formatter: Greeting / Discovery
// ─────────────────────────────────────────────
export function formatGreeting(session) {
    const hasContext = session.skinType || session.concerns.length > 0;

    const text = hasContext
        ? `👋 **Welcome back! VChat is at your service.**\n\nI remember your skincare profile:\n• **Skin Type:** ${session.skinType ? session.skinType.toUpperCase() : 'Not Set'}\n• **Concerns:** ${session.concerns.length > 0 ? session.concerns.join(', ') : 'Not Set'}\n• **Budget:** ${session.budget ? `$${session.budget}` : 'Unlimited'}\n\nHow can I help you discover skincare today? You can choose a quick action below or ask me anything!`
        : `🌟 **Hello! I'm VChat, your Clinical AI Shopping Assistant.**\n\nI am not a generic chat wrapper; I have deep access to product inventories, chemical ingredient profiles, and verified review fraud scanners.\n\nLet's get you set up! Choose **"Skincare Discovery Flow"** to configure your skin profile, or ask me any question directly.`;

    return buildResponse({
        text,
        type: 'greeting',
        followUpQuestions: [
            'Start Skincare Discovery Flow 🚀',
            'Build me a skincare routine 🌅',
            'Explain salicylic acid 🧬',
            'Compare two moisturizers ⚖️',
        ]
    });
}

// ─────────────────────────────────────────────
// Formatter: General AI Chat fallback
// ─────────────────────────────────────────────
export function formatGeneralChat(aiText) {
    return buildResponse({
        text: aiText || '🤖 I\'m processing your clinical skincare query. Let me think...',
        type: 'text',
        followUpQuestions: [
            'Search for skincare products 🔍',
            'Tell me about niacinamide 🧬',
            'Build me a routine 🌅',
        ]
    });
}

// ─────────────────────────────────────────────
// Formatter: Skin Concern → Product Search
// ─────────────────────────────────────────────
export function formatSkinConcernResponse(concern, toolResult, session) {
    const concernPhrases = {
        'acne': 'fight acne breakouts, clear clogged pores, and soothe inflamed blemishes',
        'dark spots': 'fade hyperpigmentation, brighten dull sun tanning, and restore natural glow',
        'dryness': 'deeply hydrate cellular layers and restore dry flaky skin patches',
        'wrinkles': 'minimize the depth of fine lines and boost underlying collagen production',
        'oily skin': 'control excess sebum production and minimize greasy skin shine',
        'sensitivity': 'calm active redness, soothe skin irritation, and fortify compromised barriers',
    };

    const phrase = concernPhrases[concern] || 'address your target skincare objectives';
    const { products } = toolResult;
    const contextStr = session.budget ? ` (within your $${session.budget} budget)` : '';

    const text = `💊 **Targeted Treatments for ${concern ? concern.charAt(0).toUpperCase() + concern.slice(1) : 'Your Concern'}**\n\n` +
        `I've parsed our inventory for products clinically proven to **${phrase}**${contextStr}:`;

    return buildResponse({
        text,
        type: 'product_list',
        data: { products },
        followUpQuestions: [
            'What ingredients help with this concern? 🧬',
            `Build me a routine for ${concern || 'my concern'} 🌅`,
            'Compare the top two options ⚖️',
        ]
    });
}
