import { logger } from '../../utils/logger.js';
import { llmClient } from './llmClient.js';

const INTENTS = {
    GREETING: 'GREETING',
    PRODUCT_SEARCH: 'PRODUCT_SEARCH',
    PRODUCT_RECOMMENDATION: 'PRODUCT_RECOMMENDATION',
    COMPARE: 'COMPARE',
    ROUTINE_BUILDER: 'ROUTINE_BUILDER',
    PRICE_INQUIRY: 'PRICE_INQUIRY',
    INGREDIENT_INFO: 'INGREDIENT_INFO',
    TRUST_ANALYSIS: 'TRUST_ANALYSIS',
    GENERAL_CHAT: 'GENERAL_CHAT'
};

// Local pattern match extractors for offline fallback
const SKIN_TYPES = ['oily', 'dry', 'sensitive', 'normal', 'combination'];
const CONCERNS = {
    'acne': ['acne', 'pimple', 'blackhead', 'breakout', 'blemish'],
    'dark spots': ['dark spot', 'hyperpigment', 'melasma', 'uneven tone', 'sun damage', 'tan'],
    'anti-aging': ['wrinkle', 'fine line', 'aging', 'anti-age', 'firmness'],
    'dryness': ['dry skin', 'dryness', 'dehydrat', 'flaky'],
    'oily skin': ['oily skin', 'excess oil', 'oily', 'sebum'],
    'sensitivity': ['sensitive', 'redness', 'rosacea', 'irritation', 'sensitivities'],
    'dark circles': ['dark circle', 'under eye', 'puffy eye'],
    'large pores': ['pore', 'large pore', 'open pore']
};
const INGREDIENTS = [
    'niacinamide', 'retinol', 'hyaluronic acid', 'salicylic acid',
    'glycolic acid', 'azelaic acid', 'vitamin c', 'ceramide', 'ceramides',
    'peptide', 'peptides', 'benzoyl peroxide', 'lactic acid', 'kojic acid',
    'resveratrol', 'bakuchiol', 'snail mucin'
];
const BRANDS = ['himalaya', 'derma co', 'mamaearth', 'minimalist', 'luminis', 'dermaglow', 'cetaphil', 'cerave', 'neutrogena', 'ordinary', 'sephora', 'nykaa', 'walmart', 'amazon', 'flipkart'];

export const intentDetector = {
    /**
     * Detects intent and extracts entities from user query.
     */
    async detectIntent(message, keys = {}) {
        const geminiKey = keys.geminiKey || process.env.GEMINI_API_KEY || (process.env.AI_API_KEY?.startsWith('AIzaSy') ? process.env.AI_API_KEY : null);
        const groqKey = keys.groqKey || process.env.GROQ_API_KEY;

        const lowerMsg = message.toLowerCase().trim();

        // If any API key is active, query llmClient
        if ((geminiKey && !geminiKey.startsWith('gsk_')) || groqKey) {
            try {
                const prompt = `You are a high-performance shopping intent classifier and entity extractor.
Classify the user message and extract entities.
INTENTS:
- "GREETING": Hello, reset commands, general start/guided discovery prompts.
- "PRODUCT_SEARCH": Explicit searches for items (e.g., "find a face wash", "look for sunscreen").
- "PRODUCT_RECOMMENDATION": Requests for suggestions (e.g., "what is the best moisturizer for me?").
- "COMPARE": Side-by-side comparison of items/brands (e.g., "Product A vs Product B", "compare C and D").
- "ROUTINE_BUILDER": Skincare regimen creation (e.g., "build me a morning skincare routine").
- "PRICE_INQUIRY": Inquiries on prices, cost-efficiency, budgets (e.g., "how much is Cetaphil?", "items under $20").
- "INGREDIENT_INFO": Questions on active chemicals/ingredients (e.g., "tell me about retinol", "what does niacinamide do?").
- "TRUST_ANALYSIS": Scanning reviews for authenticity, fake reviews, verified integrity (e.g., "is Cetaphil legit?", "can I trust reviews for A?").
- "GENERAL_CHAT": Small talk, jokes, greetings not fitting start flow.

ENTITIES to extract (null if not found):
- "product_a": (string) First product name referenced.
- "product_b": (string) Second product name referenced.
- "ingredient": (string) Specific chemical active named.
- "skin_type": (string) oily | dry | sensitive | normal | combination.
- "concern": (string) acne | dark spots | anti-aging | dryness | oily skin | sensitivity | large pores.
- "budget": (number) Max budget limit extracted if mentioned.
- "brand": (string) Retailer/Brand name.
- "category": (string) E.g. Skincare & Beauty, Electronics, Groceries, Home & Living, Fashion & Apparel.
- "specifications": (array of strings) Technical details/features (e.g., ["RTX 4060", "16GB RAM", "SPF 50", "Fragrance-Free"]).
- "exclusions": (array of strings) Ingredients or attributes to avoid (e.g. ["fragrance", "alcohol", "paraben", "silicone"]).

USER MESSAGE: "${message}"

Return a JSON object:
{
  "intent": "INTENT_NAME",
  "confidence": 0.0 to 1.0,
  "entities": {
    "product_a": string | null,
    "product_b": string | null,
    "ingredient": string | null,
    "skin_type": string | null,
    "concern": string | null,
    "budget": number | null,
    "brand": string | null,
    "category": string | null,
    "specifications": string[] | null,
    "exclusions": string[] | null
  }
}
Return ONLY a valid JSON. Do not wrap in markdown tags.`;

                const text = await llmClient.query({
                    prompt,
                    jsonMode: true,
                    keys
                });

                if (text) {
                    const parsed = JSON.parse(text);
                    logger.info(`[INTENT DETECTOR] LLM identified: ${parsed.intent} (Confidence: ${parsed.confidence})`, 'AI_INTENT');
                    return parsed;
                }
            } catch (err) {
                logger.error(`[INTENT DETECTOR] LLM classifier failed: ${err.message}. Cascading to rule fallback.`, 'AI_INTENT');
            }
        }

        // Rule-based Fallback
        return this.localFallback(message);
    },

    localFallback(message) {
        const lowerMsg = message.toLowerCase();
        let intent = INTENTS.GENERAL_CHAT;
        let confidence = 0.6;

        // Intent logic rules
        if (/hi|hello|hey|hiya|howdy|reset/i.test(message)) {
            intent = INTENTS.GREETING;
            confidence = 0.9;
        } else if (/compar(e|ing|ison)|vs\.?\s|versus|better\s+(than|between|choice)|difference/i.test(message)) {
            intent = INTENTS.COMPARE;
            confidence = 0.9;
        } else if (/routin(e|es)|build.*routine|skincare\s+plan|morning|night/i.test(message)) {
            intent = INTENTS.ROUTINE_BUILDER;
            confidence = 0.9;
        } else if (/how\s+much|cost|price|buy|budget|under\s+\$?\d+/i.test(message)) {
            intent = INTENTS.PRICE_INQUIRY;
            confidence = 0.8;
        } else if (/ingredi(ent|ents)|niacinamide|retinol|hyaluronic|salicylic|glycolic|vitamin\s+c|ceramide|peptide|actives/i.test(message)) {
            intent = INTENTS.INGREDIENT_INFO;
            confidence = 0.8;
        } else if (/fake|genuine|authentic|trust|legit|spam|manipulate/i.test(message)) {
            intent = INTENTS.TRUST_ANALYSIS;
            confidence = 0.85;
        } else if (/recommend|suggest|best|any\s+(good|great|top)/i.test(message)) {
            intent = INTENTS.PRODUCT_RECOMMENDATION;
            confidence = 0.8;
        } else if (/find|search|look\s+for|show\s+me|cleanser|serum|moisturizer/i.test(message)) {
            intent = INTENTS.PRODUCT_SEARCH;
            confidence = 0.85;
        }

        // Entity extraction rules
        const entities = {
            product_a: null,
            product_b: null,
            ingredient: null,
            skin_type: null,
            concern: null,
            budget: null,
            brand: null,
            category: null,
            specifications: null,
            exclusions: null
        };

        // Extract budget
        const budgetMatch = lowerMsg.match(/(?:under|below|budget\s+of|<\s*|price\s*<\s*)\s*(?:rs\.?\s*|₹|\$)?\s*(\d+)/i);
        if (budgetMatch) {
            entities.budget = parseInt(budgetMatch[1]);
        }

        // Extract skin type
        const skinType = SKIN_TYPES.find(st => lowerMsg.includes(st));
        if (skinType) entities.skin_type = skinType;

        // Extract concern
        for (const [key, triggers] of Object.entries(CONCERNS)) {
            if (triggers.some(t => lowerMsg.includes(t))) {
                entities.concern = key;
                break;
            }
        }

        // Extract ingredient
        const ingredient = INGREDIENTS.find(ing => lowerMsg.includes(ing));
        if (ingredient) entities.ingredient = ingredient;

        // Extract brand
        const brand = BRANDS.find(b => lowerMsg.includes(b));
        if (brand) entities.brand = brand;

        // Extract category fallback
        if (lowerMsg.match(/laptop|computer|phone|camera|keyboard|monitor|cpu|gpu|ram|charger|headphone|mouse|electronics|tv|speaker/)) {
            entities.category = 'Electronics';
        } else if (lowerMsg.match(/milk|bread|apple|coffee|tea|chocolate|groceries|egg|rice|sugar|snack|fruit|vegetable/)) {
            entities.category = 'Groceries';
        } else if (lowerMsg.match(/shirt|jeans|shoes|jacket|dress|bag|fashion|socks|hat|watch|apparel/)) {
            entities.category = 'Fashion & Apparel';
        } else if (lowerMsg.match(/chair|table|lamp|sofa|bed|pillow|decor|furniture|kitchen|dining/)) {
            entities.category = 'Home & Living';
        } else if (lowerMsg.match(/serum|facewash|cream|moisturizer|scrub|toner|shampoo|lotion|ubtan|neem|skincare|beauty/)) {
            entities.category = 'Skincare & Beauty';
        }

        // Extract specifications (e.g. RTX 4060, 16GB, SPF 50, etc.)
        const specMatches = [];
        const rtxMatch = lowerMsg.match(/rtx\s*\d{4}/i);
        if (rtxMatch) specMatches.push(rtxMatch[0]);
        const ramMatch = lowerMsg.match(/\d+\s*gb\s*(?:ram)?/i);
        if (ramMatch) specMatches.push(ramMatch[0]);
        const spfMatch = lowerMsg.match(/spf\s*\d+/i);
        if (spfMatch) specMatches.push(spfMatch[0]);
        const sizeMatch = lowerMsg.match(/\d+\s*(?:ml|g)/i);
        if (sizeMatch) specMatches.push(sizeMatch[0]);
        if (lowerMsg.includes('waterproof')) specMatches.push('waterproof');
        if (lowerMsg.includes('wireless')) specMatches.push('wireless');
        if (specMatches.length > 0) entities.specifications = specMatches;

        // Extract exclusions (e.g. without fragrance, no alcohol, free of parabens)
        const exclusionsMatches = [];
        const withoutMatch = lowerMsg.match(/(?:without|no|free\s+of|avoid|excluding)\s+([a-z\s]+)/i);
        if (withoutMatch) {
            const items = withoutMatch[1].split(/,|and/);
            items.forEach(item => {
                const cleaned = item.trim().split(/\s+/)[0];
                if (cleaned.length > 2) exclusionsMatches.push(cleaned);
            });
        }
        if (lowerMsg.includes('fragrance-free') || lowerMsg.includes('unscented')) {
            exclusionsMatches.push('fragrance');
        }
        if (exclusionsMatches.length > 0) entities.exclusions = exclusionsMatches;

        // Extract comparison items (e.g. Cetaphil vs CeraVe)
        if (intent === INTENTS.COMPARE) {
            const vsMatch = message.match(/(.+?)\s+(?:vs\.?|versus|and)\s+(.+)/i);
            if (vsMatch) {
                entities.product_a = vsMatch[1].replace(/compare/gi, '').trim();
                entities.product_b = vsMatch[2].trim();
            }
        } else {
            // Pick default product_a if search keywords are parsed
            const matches = message.replace(/find|search|show me|look for/gi, '').trim();
            if (matches.length > 3) {
                entities.product_a = matches;
            }
        }

        logger.info(`[INTENT DETECTOR] Local Fallback: ${intent} (Entities: ${JSON.stringify(entities)})`, 'AI_INTENT');
        return { intent, confidence, entities };
    }
};
