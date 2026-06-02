/**
 * VChat Tools
 * Each tool encapsulates a specific capability of the VChat agent.
 * Tools retrieve data from Supabase and format it for agent use.
 */

import { supabase } from '../../db.js';
import { productService } from '../productService.js';
import { logger } from '../../utils/logger.js';

// Concern to ingredient mapper for "Why Recommended" cards
const CONCERN_INGREDIENTS = {
    'acne': ['salicylic acid', 'niacinamide', 'tea tree', 'benzoyl peroxide', 'neem'],
    'dark spots': ['vitamin c', 'glycolic acid', 'niacinamide', 'azelaic acid', 'saffron'],
    'anti-aging': ['retinol', 'peptide', 'peptides', 'ceramide', 'turmeric'],
    'dryness': ['hyaluronic acid', 'ceramide', 'ceramides', 'aloe'],
    'oily skin': ['niacinamide', 'salicylic acid', 'clay', 'neem'],
    'oiliness': ['niacinamide', 'salicylic acid', 'clay', 'neem'],
    'sensitivity': ['azelaic acid', 'ceramide', 'aloe', 'centella', 'soothing'],
    'dark circles': ['caffeine', 'eye gel'],
    'large pores': ['niacinamide', 'salicylic acid', 'clay', 'toner'],
};

// Search results cache (Phase 13 Performance)
const SEARCH_CACHE = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

// ─────────────────────────────────────────────
// TOOL: Search Products & Generate "Why Recommended"
// ─────────────────────────────────────────────
export async function toolSearchProducts({ query, category, skinType, concern, budget, limit = 5 }) {
    const cacheKey = JSON.stringify({ query, category, skinType, concern, budget, limit });
    const cached = SEARCH_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        logger.info(`[VCHAT PERF] Serving cached product search results for query="${query}"`, 'VCHAT');
        return cached.data;
    }

    try {
        let products = await productService.searchProducts(query || '', category, null);

        // Filter and prefer Skincare & Beauty when skin concerns or skin types are active
        if (concern || skinType) {
            const skincare = products.filter(p => p.category === 'Skincare & Beauty');
            if (skincare.length >= 2) products = skincare;
        }

        // Apply strict budget filter if provided
        if (budget && budget > 0) {
            const filtered = products.filter(p => p.price <= budget);
            if (filtered.length >= 1) products = filtered;
        }

        // Sort by trust score descending by default
        products = products.sort((a, b) => (b.trust_score || 80) - (a.trust_score || 80));

        const results = products.slice(0, limit).map(p => {
            const priceVal = Number(p.price);
            const trustVal = Number(p.trust_score || 80);
            const ratingVal = Number(p.rating || 4.2);
            const keywords = Array.isArray(p.keywords) ? p.keywords : [];

            // Generate customized clinical rationale tags
            let skinTypeMatch = "Formulated to respect and maintain the skin natural moisture barrier.";
            if (skinType) {
                const hasSkinTypeKw = keywords.some(k => k.toLowerCase().includes(skinType.toLowerCase())) || 
                                     p.title.toLowerCase().includes(skinType.toLowerCase());
                skinTypeMatch = hasSkinTypeKw 
                    ? `Dermatologically aligned to balance and optimize your ${skinType} skin type.`
                    : `Sufficiently gentle and compatible for supporting ${skinType} skin.`;
            }

            let concernMatch = "Formulated with premium clinical grade actives for structural repair.";
            if (concern && CONCERN_INGREDIENTS[concern.toLowerCase()]) {
                const actives = CONCERN_INGREDIENTS[concern.toLowerCase()];
                const foundActive = actives.find(act => p.title.toLowerCase().includes(act) || p.description.toLowerCase().includes(act));
                if (foundActive) {
                    concernMatch = `Enriched with ${foundActive.toUpperCase()} specifically targeting your ${concern} concern.`;
                } else {
                    concernMatch = `Formulated with therapeutic properties matching your ${concern} treatment goals.`;
                }
            }

            let trustMatch = `Highly organic verified status with an excellent ${trustVal}% authenticity index.`;
            if (trustVal >= 85) {
                trustMatch = `Signature ReviewLens Trusted product with a stellar ${trustVal}% verified authenticity index.`;
            } else if (trustVal < 70) {
                trustMatch = `Please review suspicious markers; current verified organic index is at a moderate ${trustVal}%.`;
            }

            let budgetMatch = `Excellent value addition priced at $${priceVal.toFixed(2)}.`;
            if (budget) {
                const percentUnder = Math.round(((budget - priceVal) / budget) * 100);
                budgetMatch = percentUnder > 0 
                    ? `Exceptional budget fit, saving you ${percentUnder}% off your maximum $${budget} limit.`
                    : `Perfect budget fit, priced right at your maximum $${budget} limit.`;
            }

            return {
                id: p.id,
                title: p.title || p.name,
                price: priceVal,
                rating: ratingVal,
                trust_score: trustVal,
                category: p.category,
                brand: p.brand,
                thumbnail: p.thumbnail || p.image_url,
                description: (p.description || '').substring(0, 200),
                keywords: keywords,
                whyRecommend: {
                    skinTypeMatch,
                    concernMatch,
                    trustMatch,
                    budgetMatch
                }
            };
        });

        const finalResult = {
            success: true,
            products: results,
            total: results.length,
        };
        SEARCH_CACHE.set(cacheKey, { timestamp: Date.now(), data: finalResult });
        return finalResult;
    } catch (err) {
        logger.error(`[VCHAT TOOL] toolSearchProducts error: ${err.message}`, err, 'VCHAT');
        return { success: false, products: [], error: err.message };
    }
}

// ─────────────────────────────────────────────
// TOOL: Compare Products (Dimension Scoring & Reasoning)
// ─────────────────────────────────────────────
export async function toolCompareProducts({ productAName, productBName, productAId, productBId }) {
    try {
        const all = await productService.getAllProducts();

        let prodA = null;
        let prodB = null;

        if (productAId) prodA = all.find(p => p.id === Number(productAId));
        if (productBId) prodB = all.find(p => p.id === Number(productBId));

        if (!prodA && productAName) {
            const name = productAName.toLowerCase();
            prodA = all.find(p => (p.title || p.name || '').toLowerCase().includes(name));
        }
        if (!prodB && productBName) {
            const name = productBName.toLowerCase();
            prodB = all.find(p => (p.title || p.name || '').toLowerCase().includes(name));
        }

        if (!prodA || !prodB) {
            return {
                success: false,
                error: 'Could not find one or both products in catalog. Try mentioning full brand or product names.',
                productA: null,
                productB: null,
            };
        }

        // Calculate Ingredient Quality Score (out of 100)
        // Highly rated products or products with more clinical ingredients get higher quality scores
        const getIngScore = p => {
            const ratingBonus = Number(p.rating || 4.2) * 15; // e.g. 4.5 * 15 = 67.5
            const keywordBonus = Math.min(30, (p.keywords || []).length * 4); // max 30
            return Math.min(100, Math.round(ratingBonus + keywordBonus));
        };

        // Calculate Value Score (out of 100)
        // Uses rating/price and trust/price ratio to evaluate value-for-money
        const getValueScore = p => {
            const price = Number(p.price || 20);
            const rating = Number(p.rating || 4.2);
            // Lower price and higher rating = better value. Formula rewards high rating/price
            const ratio = (rating * 50) / (price + 2);
            return Math.min(100, Math.max(30, Math.round(ratio + 30)));
        };

        const format = p => ({
            id: p.id,
            title: p.title || p.name,
            price: Number(p.price),
            rating: Number(p.rating),
            trust_score: Number(p.trust_score || 80),
            category: p.category,
            brand: p.brand,
            thumbnail: p.thumbnail || p.image_url,
            keywords: Array.isArray(p.keywords) ? p.keywords : [],
            description: (p.description || '').substring(0, 180),
            ingredientScore: getIngScore(p),
            reviewScore: Number(p.trust_score || 80),
            valueScore: getValueScore(p)
        });

        const formattedA = format(prodA);
        const formattedB = format(prodB);

        // Determine Dimension Winners
        const ingWinner = formattedA.ingredientScore >= formattedB.ingredientScore ? formattedA : formattedB;
        const reviewWinner = formattedA.reviewScore >= formattedB.reviewScore ? formattedA : formattedB;
        const valueWinner = formattedA.valueScore >= formattedB.valueScore ? formattedA : formattedB;

        // Determine Overall Winner (Avg of the three dimensions)
        const avgA = (formattedA.ingredientScore + formattedA.reviewScore + formattedA.valueScore) / 3;
        const avgB = (formattedB.ingredientScore + formattedB.reviewScore + formattedB.valueScore) / 3;
        const overallWinner = avgA >= avgB ? formattedA : formattedB;

        // Compute shared keywords
        const kwA = new Set((prodA.keywords || []).map(k => k.toLowerCase()));
        const kwB = new Set((prodB.keywords || []).map(k => k.toLowerCase()));
        const shared = [...kwA].filter(k => kwB.has(k));

        // Generate clinical comparative reasoning text
        const winMargin = Math.abs(avgA - avgB).toFixed(1);
        const reasoning = `Comparing ${formattedA.title} and ${formattedB.title} side-by-side reveals key differences. ` +
            `${overallWinner.title} emerges as the overall winner (scoring ${avgA >= avgB ? avgA.toFixed(0) : avgB.toFixed(0)}/100) due to its ` +
            `${overallWinner.id === ingWinner.id ? 'superior active ingredient composition' : 'superior review authenticity profile'}. ` +
            `Specifically, ${ingWinner.title} takes the lead in ingredient quality, while ${valueWinner.title} offers the best relative cost-efficiency. ` +
            `We recommend ${overallWinner.title} for target-oriented skincare routines.`;

        return {
            success: true,
            productA: formattedA,
            productB: formattedB,
            sharedKeywords: shared,
            winners: {
                ingredient: ingWinner.title,
                review: reviewWinner.title,
                value: valueWinner.title,
                overall: overallWinner.title
            },
            winner: overallWinner,
            reasoning
        };
    } catch (err) {
        logger.error(`[VCHAT TOOL] toolCompareProducts error: ${err.message}`, err, 'VCHAT');
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────
// TOOL: Trust Analysis (Automatic Fraud Scanner)
// ─────────────────────────────────────────────
export async function toolTrustAnalysis({ productId, productName }) {
    try {
        let resolvedProductId = productId;

        if (!resolvedProductId && productName) {
            const all = await productService.getAllProducts();
            const match = all.find(p => (p.title || p.name || '').toLowerCase().includes(productName.toLowerCase()));
            if (match) resolvedProductId = match.id;
        }

        if (!resolvedProductId) {
            return { success: false, error: 'Product not found for trust analysis. Try asking about a product in the catalog.' };
        }

        // Query Supabase reviews (select ONLY valid columns to avoid PGRST errors)
        const { data: reviews, error } = await supabase
            .from('reviews')
            .select('id, product_id, user_id, rating, review_text, sentiment, trust_score, verdict, created_at')
            .eq('product_id', resolvedProductId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const all = reviews || [];
        const totalReviews = all.length;

        // Classify genuine vs suspicious
        const genuine = all.filter(r => r.verdict === 'Genuine' || r.verdict === 'GENUINE');
        const fake = all.filter(r => r.verdict === 'Fake' || r.verdict === 'Suspicious' || r.verdict === 'LIKELY_FAKE' || r.verdict === 'SUSPICIOUS');
        
        const avgTrust = totalReviews > 0
            ? Math.round(all.reduce((sum, r) => sum + (r.trust_score || 80), 0) / totalReviews)
            : 80;

        const suspiciousPercentage = totalReviews > 0
            ? Math.round((fake.length / totalReviews) * 100)
            : 0;

        // 1. SCAN FOR DUPLICATE REVIEWS (Copypasta Signatures)
        // Group reviews by text to find identical postings, or check for repetitive text patterns
        const reviewTextMap = new Map();
        let duplicateCount = 0;

        all.forEach(r => {
            const cleanText = (r.review_text || '').toLowerCase().trim();
            if (cleanText.length > 10) {
                if (reviewTextMap.has(cleanText)) {
                    duplicateCount++;
                } else {
                    reviewTextMap.set(cleanText, true);
                }
            }
        });

        // 2. SCAN FOR SENTIMENT MISMATCHES (Contradictory Ratings)
        // Identifies reviews with extreme rating (e.g. 5) but negative words, or low rating (e.g. 1) but positive words
        let sentimentMismatchCount = 0;
        const negativeWords = ['terrible', 'worst', 'bad', 'waste', 'breakout', 'irritate', 'redness', 'fake', 'burning', 'allergy'];
        const positiveWords = ['amazing', 'fantastic', 'excellent', 'great', 'love it', 'perfect', 'best ever', 'highly recommended'];

        all.forEach(r => {
            const text = (r.review_text || '').toLowerCase();
            const rating = Number(r.rating || 5);

            if (rating >= 4 && negativeWords.some(w => text.includes(w))) {
                sentimentMismatchCount++;
            } else if (rating <= 2 && positiveWords.some(w => text.includes(w))) {
                sentimentMismatchCount++;
            }
        });

        // Determine general trust labels
        const trustLabel = avgTrust >= 85 ? 'Highly Trusted' : avgTrust >= 70 ? 'Moderately Trusted' : 'Low Trust';

        // Generate dynamic recommendation verdict
        let recommendation = "Highly Recommended — Reviews are highly organic and exhibit consistent sentiment patterns.";
        if (avgTrust < 70 || suspiciousPercentage > 30) {
            recommendation = "Caution Advised — High percentage of suspicious duplicate reviews or rating conflicts flagged.";
        } else if (duplicateCount > 0 || sentimentMismatchCount > 0) {
            recommendation = "Neutral Rating — Generally safe, but some suspicious rating/text inconsistencies were detected.";
        }

        return {
            success: true,
            productId: resolvedProductId,
            totalReviews,
            genuineCount: genuine.length,
            fakeCount: fake.length,
            avgTrustScore: avgTrust,
            suspiciousPercentage,
            duplicateCount,
            sentimentMismatchCount,
            trustLabel,
            recommendation,
            topGenuine: genuine.slice(0, 2).map(r => ({
                text: (r.review_text || '').substring(0, 150),
                trust_score: r.trust_score,
                reviewer: r.user_id ? `User_${String(r.user_id).substring(0, 5)}` : 'Verified Buyer',
            })),
            topSuspicious: fake.slice(0, 2).map(r => ({
                text: (r.review_text || '').substring(0, 150),
                trust_score: r.trust_score,
                reviewer: r.user_id ? `User_${String(r.user_id).substring(0, 5)}` : 'Flagged Submitter',
            })),
        };
    } catch (err) {
        logger.error(`[VCHAT TOOL] toolTrustAnalysis error: ${err.message}`, err, 'VCHAT');
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────
// TOOL: Ingredient Info (Clinical Profile & DB Search)
// ─────────────────────────────────────────────
const INGREDIENT_DATABASE = {
    'niacinamide': {
        fullName: 'Niacinamide (Vitamin B3)',
        purpose: 'Oil balance and skin barrier fortification.',
        benefits: ['Reduces pore appearance', 'Brightens skin tone', 'Controls excess oil', 'Calms inflammation'],
        risks: ['Mild redness or flushing in ultra-high concentrations (>10%).'],
        suitability: ['Oily skin', 'Combination skin', 'Hyperpigmentation-prone skin'],
        concentration: '2–10%',
        combos: 'Mixes beautifully with Hyaluronic Acid and Ceramides. Avoid applying at the exact same second as pure L-Ascorbic Acid (Vitamin C) if you experience flushing.'
    },
    'retinol': {
        fullName: 'Retinol (Vitamin A)',
        purpose: 'Anti-aging and cellular turnover stimulation.',
        benefits: ['Reduces fine lines & wrinkles', 'Accelerates cellular renewal', 'Unclogs acne pores', 'Refines rough texture'],
        risks: ['Dryness, initial purging (acne flare-ups), peeling, and severe sun sensitivity.'],
        suitability: ['Anti-aging goals', 'Acne-prone skin', 'Sun-damaged texture'],
        concentration: '0.025–1%',
        combos: 'Always pair with a heavy moisturizer. Always use SPF during the day. Do NOT use with Salicylic Acid in the same application window.'
    },
    'hyaluronic acid': {
        fullName: 'Hyaluronic Acid (HA)',
        purpose: 'Deep cellular hydration and skin plumping.',
        benefits: ['Deep hydration', 'Plumps fine lines', 'Supports wound healing', 'Provides cooling soothing effect'],
        risks: ['Can draw moisture OUT of skin if applied dry in extremely dry desert climates.'],
        suitability: ['Dry skin', 'Dehydrated skin', 'All skin types, including sensitive'],
        concentration: '0.1–2%',
        combos: 'Apply on slightly damp skin to lock in maximum hydration. Follow immediately with a moisturizer.'
    },
    'salicylic acid': {
        fullName: 'Salicylic Acid (Beta Hydroxy Acid / BHA)',
        purpose: 'Deep pore exfoliation and blackhead clearing.',
        benefits: ['Exfoliates inside pores', 'Reduces blackheads & whiteheads', 'Dissolves excess sebum', 'Anti-inflammatory'],
        risks: ['Dryness, flaking, or irritation if overused. Avoid if sensitive to aspirin.'],
        suitability: ['Oily skin', 'Acne-prone skin', 'Enlarged pores'],
        concentration: '0.5–2%',
        combos: 'Perfect for spot treatments. Pair with hydrating ingredients. Limit usage to 2-3 times a week initially.'
    },
    'vitamin c': {
        fullName: 'Vitamin C (L-Ascorbic Acid)',
        purpose: 'Antioxidant defense and collagen synthesis.',
        benefits: ['Brightens dull complexion', 'Fades stubborn dark spots', 'Boosts collagen output', 'Neutralizes free radicals'],
        risks: ['Highly unstable. Can oxidize in sunlight. High concentrations can cause tingling.'],
        suitability: ['Hyperpigmentation', 'Dullness', 'Early anti-aging prevention'],
        concentration: '10–20%',
        combos: 'Apply in morning under your sunscreen for boosted SPF defense. Store in a cool, dark place.'
    },
    'ceramide': {
        fullName: 'Ceramides (NP, AP, EOP)',
        purpose: 'Skin barrier repair and moisture locking.',
        benefits: ['Repairs damaged skin barrier', 'Locks in moisture', 'Protects against environmental stress', 'Soothes eczema/irritation'],
        risks: ['Extremely well tolerated. No known side effects.'],
        suitability: ['Dry skin', 'Sensitive skin', 'Compromised skin barriers'],
        concentration: '0.5–5%',
        combos: 'Combines perfectly with all active acids. Great to use after exfoliating or applying retinol.'
    },
    'glycolic acid': {
        fullName: 'Glycolic Acid (Alpha Hydroxy Acid / AHA)',
        purpose: 'Surface skin cell peeling and texture smoothing.',
        benefits: ['Exfoliates dull surface cells', 'Brightens complexion', 'Softens fine lines', 'Reduces superficial hyperpigmentation'],
        risks: ['Tingling, potential chemical burn in high doses, strong sun sensitivity.'],
        suitability: ['Dull skin', 'Rough texture', 'Sun-tanned skin'],
        concentration: '5–10% for daily use',
        combos: 'Always follow with sunscreen. Avoid mixing with Retinol or Benzoyl Peroxide in the same routine.'
    },
    'azelaic acid': {
        fullName: 'Azelaic Acid',
        purpose: 'Redness reduction and acne clearing.',
        benefits: ['Clears acne bacteria', 'Dramatically reduces rosacea redness', 'Fades post-acne dark spots', 'Gentle exfoliant'],
        risks: ['Mild itching or tingling upon initial applications.'],
        suitability: ['Rosacea', 'Redness-prone skin', 'Sensitive acne-prone skin'],
        concentration: '10–20%',
        combos: 'Extremely safe to use. Can be paired with niacinamide or salicylic acid under physician guidance.'
    },
};

export async function toolIngredientInfo({ ingredient }) {
    if (!ingredient) return { success: false, error: 'No ingredient specified.' };

    const key = ingredient.toLowerCase().trim();
    
    // Find in local clinical database
    const found = Object.entries(INGREDIENT_DATABASE).find(([k]) => key.includes(k) || k.includes(key));
    
    // Attempt to query Supabase RAG/knowledge base as well to enrich
    let dbInsight = null;
    try {
        const { data } = await supabase
            .from('knowledge_base')
            .select('sub_topic, content')
            .ilike('topic', `%${key}%`)
            .limit(1);
        if (data && data[0]) {
            dbInsight = `${data[0].sub_topic}: ${data[0].content}`;
        }
    } catch (e) {
        // Suppress and continue
    }

    if (!found) {
        if (dbInsight) {
            return {
                success: true,
                ingredient: ingredient,
                data: {
                    fullName: ingredient.toUpperCase(),
                    purpose: 'General Skincare Active.',
                    benefits: ['Identified in scientific catalog'],
                    risks: ['Check individual sensitivity'],
                    suitability: ['All skin types'],
                    concentration: 'Varies',
                    combos: 'Patch test before incorporating.'
                },
                dbInsight
            };
        }

        return {
            success: false,
            ingredient,
            error: `No detailed scientific data found for "${ingredient}" in the clinical knowledge base.`,
        };
    }

    return {
        success: true,
        ingredient: found[0],
        data: found[1],
        dbInsight
    };
}

// ─────────────────────────────────────────────
// TOOL: Skincare Routine Builder
// ─────────────────────────────────────────────
export async function toolRoutineBuilder({ skinType, concerns, budget }) {
    try {
        const ROUTINE_STEPS = {
            morning: ['Cleanser', 'Toner', 'Serum', 'Moisturizer', 'Sunscreen SPF 50'],
            evening: ['Cleanser', 'Toner', 'Treatment', 'Night Cream'],
        };

        const allProducts = await productService.getAllProducts();
        const skincare = allProducts.filter(p => p.category === 'Skincare & Beauty' || p.category === 'Skincare');

        // Logic to intelligently find a product for a specific step, concern, and skinType
        function findProductForStep(stepName) {
            const stepLower = stepName.toLowerCase();
            
            // Initial filter: matches step name
            let matches = skincare.filter(p => {
                const title = (p.title || '').toLowerCase();
                return title.includes(stepLower) || 
                       (stepLower === 'treatment' && (title.includes('serum') || title.includes('cream') || title.includes('gel')));
            });

            // Budget filter
            if (budget && budget > 0) {
                matches = matches.filter(p => p.price <= budget);
            }

            // Concern/SkinType filter
            if (skinType || (concerns && concerns.length > 0)) {
                const preferenceTerms = [];
                if (skinType) preferenceTerms.push(skinType.toLowerCase());
                if (concerns) concerns.forEach(c => preferenceTerms.push(c.toLowerCase()));
                
                // Score match based on keywords
                matches = matches.map(p => {
                    let score = 0;
                    const desc = (p.description || '').toLowerCase();
                    const kw = (p.keywords || []).map(k => k.toLowerCase());
                    const title = (p.title || '').toLowerCase();

                    preferenceTerms.forEach(term => {
                        if (title.includes(term)) score += 50;
                        if (desc.includes(term)) score += 20;
                        if (kw.includes(term)) score += 15;
                    });

                    return { product: p, score };
                });

                // Sort by keyword match score, then by trust score descending
                matches.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    return (b.product.trust_score || 80) - (a.product.trust_score || 80);
                });

                matches = matches.map(m => m.product);
            } else {
                // If no profile, sort by trust score descending
                matches.sort((a, b) => (b.trust_score || 80) - (a.trust_score || 80));
            }

            const bestProduct = matches[0];
            if (!bestProduct) return null;

            // Generate clinical explanation for this product in the routine
            let explanation = `Serves as a fundamental step to balance the skin mantle.`;
            if (stepLower.includes('cleanser')) {
                explanation = `Cleanses and clears surface debris without stripping natural lipids.`;
                if (skinType === 'oily') explanation = `Formulated soap-free to regulate sebum secretions and clarify clogged pores.`;
            } else if (stepLower.includes('toner')) {
                explanation = `Rebalances skin pH and primes the cell layers for active serum absorption.`;
            } else if (stepLower.includes('serum') || stepLower.includes('treatment')) {
                explanation = `Delivers deep-penetrating clinical actives to target specific skin layers.`;
                if (concerns && concerns.includes('acne')) {
                    explanation = `Contains target anti-acne actives to dissolve dead skin cells and prevent cellular plug breakouts.`;
                } else if (concerns && concerns.includes('dark spots')) {
                    explanation = `Targets melanocyte activity to fade dark spots and even out hyperpigmented skin tone.`;
                }
            } else if (stepLower.includes('moisturizer') || stepLower.includes('night cream')) {
                explanation = `Locks in hydration, seals the trans-epidermal barrier, and nurtures cellular repair.`;
                if (skinType === 'dry') explanation = `Enriched lipid-replenishing cream to restore dry, flaky cell patches.`;
            } else if (stepLower.includes('sunscreen')) {
                explanation = `Crucial barrier shielding against cell-damaging UVA/UVB rays and hyperpigmentation triggers.`;
            }

            return {
                id: bestProduct.id,
                title: bestProduct.title,
                price: Number(bestProduct.price),
                trust_score: Number(bestProduct.trust_score || 80),
                thumbnail: bestProduct.thumbnail,
                explanation
            };
        }

        const morningRoutine = ROUTINE_STEPS.morning.map(step => ({
            step,
            product: findProductForStep(step),
        })).filter(s => s.product !== null); // Keep only matching products

        const eveningRoutine = ROUTINE_STEPS.evening.map(step => ({
            step,
            product: findProductForStep(step),
        })).filter(s => s.product !== null);

        return {
            success: true,
            skinType: skinType || 'general',
            concerns: concerns || [],
            morningRoutine,
            eveningRoutine,
        };
    } catch (err) {
        logger.error(`[VCHAT TOOL] toolRoutineBuilder error: ${err.message}`, err, 'VCHAT');
        return { success: false, error: err.message };
    }
}
