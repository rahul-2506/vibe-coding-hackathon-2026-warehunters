/**
 * VChat Agent Orchestrator
 * The brain of VChat — routes every incoming message through the right tool,
 * enriches context with session memory, and returns a rich structured response.
 *
 * Flow:
 *   User message
 *     → Sync frontend sessionContext
 *     → learnFromMessage (session memory update)
 *     → Intercept Guided Discovery States
 *     → Intercept Conversational Search Refinements
 *     → classifyIntent
 *     → select + execute tool
 *     → format response
 *     → return { response, type, data, followUpQuestions }
 */

import { classifyIntent } from './intentClassifier.js';
import { sessionMemory } from './sessionMemory.js';
import {
    toolSearchProducts,
    toolCompareProducts,
    toolTrustAnalysis,
    toolIngredientInfo,
    toolRoutineBuilder,
} from './tools.js';
import {
    formatSearchResults,
    formatComparisonResult,
    formatTrustAnalysis,
    formatIngredientInfo,
    formatRoutine,
    formatGreeting,
    formatGeneralChat,
    formatSkinConcernResponse,
    buildResponse,
} from './responseFormatter.js';
import { queryRAG } from '../ragService.js';
import { aiService } from '../aiService.js';
import { logger } from '../../utils/logger.js';

// ─────────────────────────────────────────────
// Extract entity names from message text
// ─────────────────────────────────────────────

function extractIngredient(message) {
    const knownIngredients = [
        'niacinamide', 'retinol', 'hyaluronic acid', 'salicylic acid',
        'glycolic acid', 'azelaic acid', 'vitamin c', 'ceramide', 'ceramides',
        'peptide', 'peptides', 'benzoyl peroxide', 'lactic acid', 'kojic acid',
        'resveratrol', 'bakuchiol', 'snail mucin',
    ];
    const lower = message.toLowerCase();
    return knownIngredients.find(i => lower.includes(i)) || null;
}

function extractSkinConcern(message) {
    const concerns = [
        { key: 'acne', triggers: ['acne', 'pimple', 'blackhead', 'breakout', 'blemish'] },
        { key: 'dark spots', triggers: ['dark spot', 'hyperpigment', 'melasma', 'uneven tone', 'sun damage', 'tan'] },
        { key: 'anti-aging', triggers: ['wrinkle', 'fine line', 'aging', 'anti-age', 'firmness'] },
        { key: 'dryness', triggers: ['dry skin', 'dryness', 'dehydrat', 'flaky'] },
        { key: 'oily skin', triggers: ['oily skin', 'excess oil', 'oily', 'sebum'] },
        { key: 'sensitivity', triggers: ['sensitive', 'redness', 'rosacea', 'irritation', 'sensitivities'] },
        { key: 'dark circles', triggers: ['dark circle', 'under eye', 'puffy eye'] },
        { key: 'large pores', triggers: ['pore', 'large pore', 'open pore'] },
    ];
    const lower = message.toLowerCase();
    const found = concerns.find(c => c.triggers.some(t => lower.includes(t)));
    return found ? found.key : null;
}

function extractSearchQuery(message) {
    // Strip common instruction words and extract the product-relevant part
    const cleaned = message
        .replace(/find|search|show me|look for|recommend(ation)?s?|suggest(ion)?s?|best|good|any|tell me about/gi, '')
        .replace(/products?|items?|skincare|under \$\d+/gi, '')
        .replace(/[💰✨🌸🛡️💧❄️]/g, '') // remove emojis if any from chips
        .trim();
    return cleaned.length > 2 ? cleaned : null;
}

function extractComparisonProducts(message) {
    // Match patterns like "compare X with/vs/and Y" or "X vs Y"
    const patterns = [
        /compare\s+(.+?)\s+(?:with|vs\.?|versus|and)\s+(.+)/i,
        /(.+?)\s+(?:vs\.?|versus)\s+(.+)/i,
        /which\s+is\s+better[,:]?\s+(.+?)\s+(?:or|vs\.?)\s+(.+)/i,
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
            return {
                productAName: match[1].trim(),
                productBName: match[2].trim(),
            };
        }
    }
    return null;
}

// ─────────────────────────────────────────────
// Main Orchestrator
// ─────────────────────────────────────────────

export async function vchatOrchestrate({ message, userId, sessionContext, geminiKey, openaiKey }) {
    const safeUserId = userId || 'anonymous';

    logger.info(`[VCHAT] Processing message for user=${safeUserId}: "${message.substring(0, 80)}"`, 'VCHAT');

    // 1. Sync frontend sessionContext if provided
    if (sessionContext && typeof sessionContext === 'object') {
        sessionMemory.update(safeUserId, sessionContext);
    }

    // 2. Intercept reset keywords
    if (/^\s*reset\s*$/i.test(message)) {
        const resetSession = sessionMemory.reset(safeUserId);
        return formatGreeting(resetSession);
    }

    // Retrieve active session details
    const session = sessionMemory.get(safeUserId);
    const lowerMsg = message.toLowerCase().trim();

    // 3. INTERCEPT STATEFUL GUIDED DISCOVERY FLOW (Phase 5)
    const triggersGuided = [
        'i need skincare', 'help me build a routine', 'i need a routine', 
        'skincare discovery', 'guide me', 'start skincare discovery flow', 
        'start discovery flow', 'i need help with my skin'
    ];
    if (triggersGuided.some(t => lowerMsg.includes(t)) && session.discoveryStep === null) {
        sessionMemory.update(safeUserId, { discoveryStep: 1 });
        return sessionMemory.handleGuidedDiscovery(safeUserId, message);
    }

    // If currently locked in the guided flow, process the message as the answer to the step
    if (session.discoveryStep !== null) {
        return sessionMemory.handleGuidedDiscovery(safeUserId, message);
    }

    // 4. INTERCEPT CONVERSATIONAL SEARCH REFINEMENTS (Phase 6 follow-up selections)
    let queryText = message;
    let isRefinement = false;

    if (session.lastSearchQuery) {
        const isBudgetRef = /budget\s+friendly|cheap|affordable|under\s+(rs\.?\s*|₹|\$)?\d+/i.test(lowerMsg);
        const isPremiumRef = /premium|expensive/i.test(lowerMsg);
        const isFragranceRef = /fragrance\s+free|scent\s+free/i.test(lowerMsg);
        const isSensitiveRef = /sensitive\s+skin|sensitivity/i.test(lowerMsg);
        const isOilyRef = /oily\s+skin|oil\s+control/i.test(lowerMsg);
        const isDryRef = /dry\s+skin|hydration/i.test(lowerMsg);

        if (isBudgetRef || isPremiumRef || isFragranceRef || isSensitiveRef || isOilyRef || isDryRef) {
            isRefinement = true;
            logger.info(`[VCHAT] Refinement detected for lastSearchQuery="${session.lastSearchQuery}"`, 'VCHAT');

            // Apply refinement preferences directly to user session
            if (isBudgetRef) {
                // If a dollar amount was mentioned, extract it
                const numMatch = lowerMsg.match(/\d+/);
                const limit = numMatch ? parseInt(numMatch[0]) : 20;
                sessionMemory.update(safeUserId, { budget: limit });
            }
            if (isPremiumRef) {
                sessionMemory.update(safeUserId, { budget: null }); // Clear budget limits for premium search
            }
            if (isSensitiveRef) {
                sessionMemory.update(safeUserId, { skinType: 'sensitive' });
            }
            if (isOilyRef) {
                sessionMemory.update(safeUserId, { skinType: 'oily' });
            }
            if (isDryRef) {
                sessionMemory.update(safeUserId, { skinType: 'dry' });
            }

            // Construct contextual refined query string
            let queryModifiers = '';
            if (isFragranceRef) queryModifiers += ' fragrance free';
            if (isPremiumRef) queryModifiers += ' premium';
            
            queryText = `${session.lastSearchQuery}${queryModifiers}`;
        }
    }

    // 5. Update session memory with message contents (only if not in guided flow)
    sessionMemory.learnFromMessage(safeUserId, message);

    // Extract dynamic query budget and category (Shopping Assistant upgrade)
    let queryBudget = null;
    const budgetMatch = lowerMsg.match(/(?:under|below|budget\s+of|<\s*|price\s*<\s*)\s*(?:rs\.?\s*|₹|\$)?\s*(\d+)/i);
    if (budgetMatch) {
        queryBudget = parseInt(budgetMatch[1]);
        sessionMemory.update(safeUserId, { budget: queryBudget });
    }

    let queryCategory = null;
    const catMap = {
        'electronics': ['phone', 'mobile', 'headphones', 'buds', 'watch', 'speaker', 'keyboard', 'mouse', 'monitor', 'router', 'powerbank', 'charger'],
        'laptops': ['laptop', 'notebook', 'macbook', 'pc', 'computer'],
        'skincare': ['serum', 'facewash', 'wash', 'cream', 'moisturizer', 'lotion', 'toner', 'cleanser', 'sunscreen', 'skincare', 'beauty'],
        'fashion': ['shirt', 'pant', 'jeans', 'shoes', 'sneakers', 'jacket', 'hoodie', 'apparel', 'fashion'],
        'groceries': ['tea', 'coffee', 'honey', 'oats', 'oil', 'milk', 'grocery', 'groceries'],
        'home': ['chair', 'table', 'lamp', 'sofa', 'rug', 'chest', 'linen', 'desk', 'living']
    };

    for (const [catName, keywords] of Object.entries(catMap)) {
        if (keywords.some(kw => lowerMsg.includes(kw))) {
            if (catName === 'electronics' || catName === 'laptops') queryCategory = 'Electronics';
            else if (catName === 'skincare') queryCategory = 'Skincare & Beauty';
            else if (catName === 'fashion') queryCategory = 'Fashion & Apparel';
            else if (catName === 'groceries') queryCategory = 'Groceries';
            else if (catName === 'home') queryCategory = 'Home & Living';
            
            if (queryCategory) {
                sessionMemory.update(safeUserId, { preferredCategories: [queryCategory] });
            }
            break;
        }
    }

    // 6. Classify intent
    let { intent } = classifyIntent(message);

    // If conversational search refinement is happening, force product search intent
    if (isRefinement) {
        intent = 'PRODUCT_SEARCH';
    }

    logger.info(`[VCHAT] Routed to intent: ${intent}`, 'VCHAT');

    try {
        // ── GREETING ──
        if (intent === 'GREETING') {
            return formatGreeting(session);
        }

        // ── INGREDIENT INFO ──
        if (intent === 'INGREDIENT_INFO') {
            const ingredient = extractIngredient(message);
            if (ingredient) {
                const result = await toolIngredientInfo({ ingredient });
                return formatIngredientInfo(result);
            }
            // No specific ingredient detected — ask clarifying question
            return buildResponse({
                text: `🧬 **Which clinical skincare active are you curious about?**\n\nI have detailed clinical data on:\n• Niacinamide (brightening + oil control)\n• Retinol (anti-aging + texture)\n• Hyaluronic Acid (hydration)\n• Salicylic Acid (acne + pores)\n• Vitamin C (dark spots + anti-oxidant)\n• Ceramides (barrier repair)\n• Glycolic Acid (exfoliation)\n• Azelaic Acid (redness + rosacea)`,
                type: 'text',
                followUpQuestions: [
                    'Tell me about niacinamide 🧬',
                    'What does retinol do? 🧪',
                    'Explain hyaluronic acid 💧',
                ]
            });
        }

        // ── TRUST ANALYSIS (Frauds & Authenticity) ──
        if (intent === 'TRUST_ANALYSIS') {
            // Try to find a product name from recent products or message
            const recentProduct = session.lastProducts[session.lastProducts.length - 1];
            const queryName = extractSearchQuery(message);
            
            const result = await toolTrustAnalysis({
                productId: recentProduct?.id,
                productName: recentProduct ? null : queryName,
            });
            return formatTrustAnalysis(result);
        }

        // ── COMPARISON ──
        if (intent === 'COMPARE') {
            const extracted = extractComparisonProducts(message);
            let toolResult;

            if (extracted) {
                toolResult = await toolCompareProducts(extracted);
            } else if (session.lastProducts.length >= 2) {
                // Use last two shown products if no explicit names given
                const [p1, p2] = session.lastProducts.slice(-2);
                toolResult = await toolCompareProducts({
                    productAId: p1.id,
                    productBId: p2.id,
                });
            } else {
                return buildResponse({
                    text: `⚖️ **Compare Skincare Products**\n\nI'd love to analyze formulas side-by-side for you! Please name two products you want to compare:\n\n*Example: "Compare Luminis Hydrating Serum with DermaGlow Clarifying Serum" or "Minimalist vs Derma Co"*`,
                    type: 'text',
                    followUpQuestions: [
                        'Compare top two serums ⚖$',
                        'Show me moisturizers first 🧴',
                    ]
                });
            }

            // Enrich with AI summary if RAG is online
            let aiAnalysis = null;
            try {
                if (toolResult.success && toolResult.productA && toolResult.productB) {
                    const compRes = await aiService.compareProducts(toolResult.productA, toolResult.productB, geminiKey, openaiKey);
                    if (compRes && compRes.analysis) {
                        aiAnalysis = compRes.analysis;
                    }
                }
            } catch (e) {
                // Fail silently
            }

            return formatComparisonResult(toolResult, aiAnalysis);
        }

        // ── ROUTINE BUILDER ──
        if (intent === 'ROUTINE_BUILDER') {
            // Check if profile parameters are missing. If so, trigger guided discovery
            if (!session.skinType && session.concerns.length === 0) {
                sessionMemory.update(safeUserId, { discoveryStep: 1 });
                return sessionMemory.handleGuidedDiscovery(safeUserId, message);
            }

            const result = await toolRoutineBuilder({
                skinType: session.skinType,
                concerns: session.concerns,
                budget: session.budget,
            });
            return formatRoutine(result);
        }

        // ── SKIN CONCERN → Product Recommendations ──
        if (intent === 'SKIN_CONCERN') {
            const concern = extractSkinConcern(message);
            const concernQueryMap = {
                'acne': 'salicylic cleanser serum acne',
                'dark spots': 'vitamin c serum brightening ubtan saffron',
                'anti-aging': 'retinol serum anti-aging night cream',
                'dryness': 'moisturizer hyaluronic hydrating aloe',
                'oily skin': 'niacinamide oil control toner neem clay',
                'sensitivity': 'soothing calm serum sensitive aloe centella',
                'dark circles': 'eye gel serum caffeine',
                'large pores': 'pore minimizer serum toner clay',
            };
            const searchQuery = concern ? (concernQueryMap[concern] || concern) : message;
            const toolResult = await toolSearchProducts({
                query: searchQuery,
                category: 'Skincare & Beauty',
                skinType: session.skinType,
                concern,
                budget: session.budget,
                limit: 5,
            });

            // Update session with found products
            if (toolResult.success && toolResult.products.length > 0) {
                sessionMemory.recordShownProducts(safeUserId, toolResult.products);
            }

            return formatSkinConcernResponse(concern, toolResult, session);
        }

        // ── PRODUCT SEARCH & PRODUCT RECOMMENDATIONS ──
        if (intent === 'PRODUCT_SEARCH' || intent === 'PRODUCT_RECOMMENDATION' || intent === 'PRICE_INQUIRY') {
            const searchQuery = extractSearchQuery(queryText) || queryText;
            const toolResult = await toolSearchProducts({
                query: searchQuery,
                category: queryCategory || (session.preferredCategories && session.preferredCategories[0]) || null,
                skinType: session.skinType,
                concern: session.concerns[0],
                budget: queryBudget || session.budget || null,
                limit: 5,
            });

            if (toolResult.success && toolResult.products.length > 0) {
                sessionMemory.recordShownProducts(safeUserId, toolResult.products);
            }

            return formatSearchResults(toolResult, session);
        }

        // ── GENERAL CHAT — RAG Fallback ──
        logger.info(`[VCHAT] Falling back to RAG for intent: ${intent}`, 'VCHAT');
        const contextSummary = sessionMemory.getContextSummary(safeUserId);
        const ragPrompt = contextSummary ? `${contextSummary}\n\nUser asks: ${message}` : message;
        const chatResult = await aiService.ragChat(ragPrompt, geminiKey, openaiKey);
        return formatGeneralChat(chatResult.response || chatResult.reply);

    } catch (err) {
        logger.error(`[VCHAT ORCHESTRATOR] Unhandled error for intent ${intent}: ${err.message}`, err, 'VCHAT');
        return buildResponse({
            text: `⚠️ **VChat is temporarily offline**\n\nI encountered an unexpected issue while loading clinical tools. Please try again.\n\n*Technical logs: ${err.message}*`,
            type: 'error',
            followUpQuestions: ['Start Skincare Discovery Flow 🚀', 'Search products 🔍'],
        });
    }
}
