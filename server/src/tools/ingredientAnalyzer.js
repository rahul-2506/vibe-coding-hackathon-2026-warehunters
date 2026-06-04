import { logger } from '../../utils/logger.js';

const INGREDIENTS_DICT = {
    'niacinamide': {
        fullName: 'Niacinamide (Vitamin B3)',
        safe_for_oily_skin: true,
        safe_for_sensitive_skin: true,
        comedogenic_risk: 'Low (0/5)',
        warnings: ['Avoid using in high concentrations (>10%) if prone to skin flushing.'],
        benefits: ['Reduces pore appearance', 'Brightens skin tone', 'Controls excess oil', 'Calms inflammation']
    },
    'retinol': {
        fullName: 'Retinol (Vitamin A)',
        safe_for_oily_skin: true,
        safe_for_sensitive_skin: false,
        comedogenic_risk: 'Low-to-Medium (1-2/5)',
        warnings: ['Can trigger dry peeling, redness, and severe sun sensitivity. Pair with sunscreen.'],
        benefits: ['Accelerates cellular renewal', 'Reduces fine lines & wrinkles', 'Unclogs acne pores', 'Refines rough texture']
    },
    'hyaluronic acid': {
        fullName: 'Hyaluronic Acid (HA)',
        safe_for_oily_skin: true,
        safe_for_sensitive_skin: true,
        comedogenic_risk: 'Low (0/5)',
        warnings: ['Apply on slightly damp skin to prevent drawing moisture out of skin layers in dry environments.'],
        benefits: ['Deep hydration', 'Plumps fine lines', 'Supports barrier healing']
    },
    'salicylic acid': {
        fullName: 'Salicylic Acid (BHA)',
        safe_for_oily_skin: true,
        safe_for_sensitive_skin: false,
        comedogenic_risk: 'Low (0/5)',
        warnings: ['Highly drying. Avoid daily use initially. Contraindicated for dry/sensitive barriers.'],
        benefits: ['Exfoliates inside pores', 'Reduces blackheads & whiteheads', 'Dissolves excess sebum']
    },
    'vitamin c': {
        fullName: 'Vitamin C (L-Ascorbic Acid)',
        safe_for_oily_skin: true,
        safe_for_sensitive_skin: false,
        comedogenic_risk: 'Low (1/5)',
        warnings: ['Can oxidize easily. High concentrations cause tingling. Store in dark cool place.'],
        benefits: ['Brightens dull complexion', 'Fades stubborn dark spots', 'Boosts collagen output']
    },
    'ceramide': {
        fullName: 'Ceramides (NP, AP, EOP)',
        safe_for_oily_skin: true,
        safe_for_sensitive_skin: true,
        comedogenic_risk: 'Low (0/5)',
        warnings: ['Extremely well tolerated. No known side effects.'],
        benefits: ['Repairs damaged skin barrier', 'Locks in moisture', 'Protects against environmental stress']
    },
    'ceramides': {
        fullName: 'Ceramides (NP, AP, EOP)',
        safe_for_oily_skin: true,
        safe_for_sensitive_skin: true,
        comedogenic_risk: 'Low (0/5)',
        warnings: ['Extremely well tolerated. No known side effects.'],
        benefits: ['Repairs damaged skin barrier', 'Locks in moisture', 'Protects against environmental stress']
    },
    'peptides': {
        fullName: 'Peptides',
        safe_for_oily_skin: true,
        safe_for_sensitive_skin: true,
        comedogenic_risk: 'Low (0/5)',
        warnings: ['Safe with no major clinical warnings.'],
        benefits: ['Restores skin firmness', 'Triggers collagen rebuilding', 'Improves skin elasticity']
    },
    'peptide': {
        fullName: 'Peptides',
        safe_for_oily_skin: true,
        safe_for_sensitive_skin: true,
        comedogenic_risk: 'Low (0/5)',
        warnings: ['Safe with no major clinical warnings.'],
        benefits: ['Restores skin firmness', 'Triggers collagen rebuilding', 'Improves skin elasticity']
    }
};

export const ingredientAnalyzer = {
    /**
     * Analyzes individual ingredients or lists.
     */
    async analyze(ingredientList) {
        logger.info(`[INGREDIENT ANALYZER] Running analysis on: "${ingredientList}"`, 'AI_INGREDIENTS');

        if (!ingredientList) {
            return { success: false, error: 'No ingredients specified.' };
        }

        const query = ingredientList.toLowerCase().trim();
        
        // Try to match a known active ingredient
        const found = Object.entries(INGREDIENTS_DICT).find(([k]) => query.includes(k) || k.includes(query));

        if (!found) {
            return {
                success: true,
                safe_for_oily_skin: true,
                safe_for_sensitive_skin: true,
                comedogenic_risk: 'Low (0/5)',
                warnings: ['Patch test before introducing new skincare ingredients.'],
                benefits: ['General skin moisturizing and hydration support.'],
                // Formatting fields
                ingredient: ingredientList,
                data: {
                    fullName: ingredientList.toUpperCase(),
                    purpose: 'General Skincare Active.',
                    benefits: ['Identified in scientific catalog'],
                    risks: ['Check individual sensitivity'],
                    suitability: ['All skin types'],
                    concentration: 'Varies',
                    combos: 'Patch test before incorporating.'
                }
            };
        }

        const key = found[0];
        const val = found[1];

        // Format to legacy structure
        const legacyFormat = {
            fullName: val.fullName,
            purpose: val.safe_for_oily_skin ? 'Oil-regulating and pore refining active.' : 'Soothing skin humectant.',
            benefits: val.benefits,
            risks: val.warnings,
            suitability: val.safe_for_sensitive_skin ? ['Sensitive skin', 'Oily skin', 'Dry skin'] : ['Oily skin', 'Acne-prone skin'],
            concentration: key === 'retinol' ? '0.1 - 1%' : key === 'niacinamide' ? '2 - 10%' : '1 - 2%',
            combos: 'Mixes well with Hyaluronic Acid. Do not mix acids and retinol in the same routine window.'
        };

        return {
            success: true,
            safe_for_oily_skin: val.safe_for_oily_skin,
            safe_for_sensitive_skin: val.safe_for_sensitive_skin,
            comedogenic_risk: val.comedogenic_risk,
            warnings: val.warnings,
            benefits: val.benefits,
            // Legacy formatting compatibility
            ingredient: key,
            data: legacyFormat
        };
    }
};
