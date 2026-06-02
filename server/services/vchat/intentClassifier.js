/**
 * VChat Intent Classifier
 * Detects what the user wants to do from their message text.
 * Returns an intent string used by the VChat orchestrator to select the right tool.
 */

// Ordered by priority — first match wins
const INTENT_PATTERNS = [
    {
        intent: 'COMPARE',
        patterns: [
            /compar(e|ing|ison)/i,
            /vs\.?\s/i,
            /versus/i,
            /which\s+(is|one|product).+(better|best)/i,
            /better\s+(than|between)/i,
            /differ(ent|ence)\s+between/i,
            /side[\s-]by[\s-]side/i,
        ]
    },
    {
        intent: 'ROUTINE_BUILDER',
        patterns: [
            /routin(e|es)/i,
            /build.*(routine|regimen|skincare\s+plan)/i,
            /skincare\s+(routine|regimen|schedule)/i,
            /morning.*(routine|steps)/i,
            /night(time)?.*(routine|cream|steps)/i,
            /step.*(skincare|routine)/i,
            /what\s+should\s+i\s+use\s+(every|daily|at\s+night|morning)/i,
        ]
    },
    {
        intent: 'PRICE_INQUIRY',
        patterns: [
            /how\s+much|what.*(cost|price)/i,
            /cheap|affordable|expensive/i,
            /price|cost|buy|purchase/i,
            /under\s+\$?\d+/i,
        ]
    },
    {
        intent: 'SEARCH_REFINEMENT',
        patterns: [
            /^(only\s+)?fragrance\s+free/i,
            /^(only\s+)?budget\s+friendly|cheaper|affordable/i,
            /^(only\s+)?premium|expensive/i,
            /^(only\s+)?sensitive\s+skin/i,
            /^(only\s+)?oily\s+skin/i,
            /^(only\s+)?dry\s+skin/i,
            /^(only\s+)?acne\s+prone/i,
        ]
    },
    {
        intent: 'INGREDIENT_INFO',
        patterns: [
            /ingredi(ent|ents)/i,
            /what\s+is\s+(in|inside)/i,
            /contain(s|ing)/i,
            /formula(ted|tion)/i,
            /niacinamide|retinol|hyaluronic|salicylic|glycolic|vitamin\s+c|ceramide|peptide|snail|bakuchiol|azelaic|benzoyl/i,
            /active\s+(ingredient|compound)/i,
            /chemical|compound|safe|benefits?|risks?/i,
        ]
    },
    {
        intent: 'TRUST_ANALYSIS',
        patterns: [
            /fake\s+review/i,
            /genuine|authentic/i,
            /trust\s+(score|rating|analysis|level)/i,
            /review\s+(analysis|trustworthiness|sentiment)/i,
            /verified\s+review/i,
            /is\s+(this|it)\s+(legit|real|trustworthy|genuine|fake)/i,
            /can\s+i\s+trust/i,
            /spam\s+review/i,
            /manipulat(ed|ion)/i,
        ]
    },
    {
        intent: 'PRODUCT_RECOMMENDATION',
        patterns: [
            /recommend(ation)?s?/i,
            /suggest(ion)?s?/i,
            /best\s+(product|serum|moisturizer|cleanser|sunscreen|toner)/i,
            /any\s+(good|great|top)/i,
            /under\s+(rs\.?\s*|₹)?\d+/i,
            /budget/i,
        ]
    },
    {
        intent: 'PRODUCT_SEARCH',
        patterns: [
            /find|search|look\s+for|show\s+me/i,
            /moisturizers?|sunscreens?|cleansers?|serums?|toners?/i,
            /products?\s+for/i,
            /skin\s+type/i,
        ]
    },
    {
        intent: 'GREETING',
        patterns: [
            /^(hi|hello|hey|hiya|howdy|greetings|good\s+(morning|evening|afternoon))\b/i,
            /^(what\s+can\s+you\s+do|help\s+me|what\s+are\s+you|what\s+is\s+vchat)[?!]?$/i,
            /^(guide\s+me|i\s+need\s+help|skincare\s+discovery)[?!]?$/i,
        ]
    },
];

/**
 * Classifies the user message into one of the VChat intent categories.
 * @param {string} message - Raw user message
 * @returns {{ intent: string, confidence: number }}
 */
export function classifyIntent(message) {
    if (!message || typeof message !== 'string') {
        return { intent: 'GENERAL_CHAT', confidence: 0.5 };
    }

    const trimmed = message.trim();

    for (const { intent, patterns } of INTENT_PATTERNS) {
        for (const pattern of patterns) {
            if (pattern.test(trimmed)) {
                return { intent, confidence: 0.9 };
            }
        }
    }

    return { intent: 'GENERAL_CHAT', confidence: 0.5 };
}
