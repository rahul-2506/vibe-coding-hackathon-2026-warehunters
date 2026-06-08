/**
 * Product Ranking Service
 * Ranks a list of products using the multi-factor hybrid formula:
 * score = 0.40 * Semantic + 0.25 * Keyword + 0.15 * Popularity + 0.10 * Preference + 0.10 * ReviewQuality
 */
const COMMON_SPELLINGS = {
    'cetaphil': 'cetaphil',
    'cetaphil gentle': 'cetaphil gentle',
    'cerave': 'cerave',
    'cerve': 'cerave',
    'iphne': 'iphone',
    'iphone': 'iphone',
    'headphone': 'headphones',
    'headphones': 'headphones',
    'samsng': 'samsung',
    'samsung': 'samsung',
    'niacinamid': 'niacinamide',
    'niacinamide': 'niacinamide',
    'salicylic': 'salicylic',
    'salicilic': 'salicylic',
    'neem': 'neem',
    'neam': 'neem',
    'dyson': 'dyson',
    'dison': 'dyson'
};

export const rankingService = {
    rankProducts(products, relevanceScoresMap = new Map(), queryContext = null) {
        if (!Array.isArray(products) || products.length === 0) {
            return [];
        }

        // 1. Find max review count to normalize popularity
        let maxReviewCount = 0;
        products.forEach(p => {
            const count = Number(p.review_count || p.reviews_count || p.reviewCount || 0);
            if (count > maxReviewCount) {
                maxReviewCount = count;
            }
        });

        // 2. Score and rank each product
        const scoredProducts = products.map(product => {
            const idKey = String(product.id);
            
            // --- 1. SEMANTIC SIMILARITY (40%) ---
            let semanticScore = relevanceScoresMap.has(idKey)
                ? Number(relevanceScoresMap.get(idKey))
                : 0.5; // default relevance
            
            // --- 2. KEYWORD RELEVANCE (25%) ---
            let keywordScore = 0.5; // default
            const query = queryContext?.query || '';
            const titleLower = (product.title || product.name || '').toLowerCase();
            const brandLower = (product.brand || '').toLowerCase();
            const catLower = (product.category || '').toLowerCase();
            const descLower = (product.description || '').toLowerCase();
            const pKeywords = Array.isArray(product.keywords) 
                ? product.keywords.map(k => String(k).toLowerCase()) 
                : typeof product.keywords === 'string' 
                    ? product.keywords.toLowerCase().split(/\s+/)
                    : [];

            if (query) {
                let words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
                // Apply spelling corrections
                words = words.map(w => COMMON_SPELLINGS[w] || w);

                if (words.length > 0) {
                    let matches = 0;
                    words.forEach(word => {
                        if (titleLower.includes(word)) {
                            // Partial match logic
                            matches += 1.0;
                        } else if (brandLower.includes(word)) {
                            matches += 0.8;
                        } else if (catLower.includes(word)) {
                            matches += 0.5;
                        } else if (pKeywords.includes(word)) {
                            matches += 0.5;
                        } else if (descLower.includes(word)) {
                            matches += 0.3;
                        }
                    });
                    keywordScore = Math.min(1.0, matches / words.length);
                }
            }

            // --- 3. PRODUCT POPULARITY (15%) ---
            const reviewCount = Number(product.review_count || product.reviews_count || product.reviewCount || 0);
            const popularityScore = maxReviewCount > 0 ? (reviewCount / maxReviewCount) : 0.5;

            // --- 4. USER PREFERENCE MATCH (10%) ---
            let preferenceScore = 0.5; // default base

            if (queryContext) {
                // Search subcategory intent boost
                if (queryContext.subcategory) {
                    const subLower = queryContext.subcategory.toLowerCase();
                    let productSub = (product.subcategory || '').toLowerCase();
                    if (!productSub) {
                        const catLower = (product.category || '').toLowerCase();
                        if (catLower === 'electronics') {
                            const nameLower = (product.title || product.name || '').toLowerCase();
                            if (nameLower.includes('laptop') || nameLower.includes('macbook')) {
                                productSub = 'laptops';
                            } else if (nameLower.includes('headphone') || nameLower.includes('earbud') || nameLower.includes('airpods')) {
                                productSub = 'headphones';
                            } else if (nameLower.includes('phone') || nameLower.includes('iphone') || nameLower.includes('galaxy') || nameLower.includes('oneplus') || nameLower.includes('nothing')) {
                                productSub = 'smartphones';
                            }
                        }
                    }
                    if (productSub === subLower) {
                        preferenceScore += 0.5; // Massive boost for matching subcategory
                    }
                }

                // Gaming/RTX intent boost
                if (queryContext.isGaming) {
                    const descLower = (product.description || '').toLowerCase();
                    const featuresStr = JSON.stringify(product.specifications || product.features || {}).toLowerCase();
                    if (titleLower.includes('gaming') || descLower.includes('rtx') || featuresStr.includes('rtx') || featuresStr.includes('gpu')) {
                        preferenceScore += 0.5; // Boost RTX/gaming laptops
                    } else {
                        preferenceScore -= 0.3; // Penalty for non-gaming items when query is gaming laptop
                    }
                }

                // Brand intent boost
                if (Array.isArray(queryContext.brands) && queryContext.brands.length > 0) {
                    const intentBrands = queryContext.brands.map(b => b.toLowerCase());
                    if (intentBrands.includes(brandLower)) {
                        preferenceScore += 0.5; // Boost specific brand searched
                    } else {
                        preferenceScore -= 0.2; // Penalize other brands slightly
                    }
                }

                // Budget boost/penalty
                if (queryContext.budget) {
                    const budget = Number(queryContext.budget);
                    const price = Number(product.price || 0);
                    if (price > 0) {
                        if (price <= budget) {
                            preferenceScore += 0.2; // boost within budget
                        } else {
                            preferenceScore -= 0.3; // penalty over budget
                        }
                    }
                }

                // Skin Type boost
                if (queryContext.skinType && queryContext.skinType.toLowerCase() !== 'normal') {
                    const skinType = queryContext.skinType.toLowerCase();
                    if (titleLower.includes(skinType) || descLower.includes(skinType) || pKeywords.includes(skinType)) {
                        preferenceScore += 0.15;
                    }
                }

                // Concerns boost
                if (Array.isArray(queryContext.concerns) && queryContext.concerns.length > 0) {
                    let concernMatches = 0;
                    queryContext.concerns.forEach(concern => {
                        const conLower = concern.toLowerCase();
                        if (titleLower.includes(conLower) || descLower.includes(conLower) || pKeywords.includes(conLower)) {
                            concernMatches += 0.1;
                        }
                    });
                    preferenceScore += Math.min(0.3, concernMatches);
                }

                // Preferred brands boost
                if (Array.isArray(queryContext.preferredBrands) && queryContext.preferredBrands.length > 0) {
                    const preferred = queryContext.preferredBrands.map(b => b.toLowerCase());
                    if (preferred.includes(brandLower)) {
                        preferenceScore += 0.15;
                    }
                }

                // Disliked ingredients exclusion penalty
                if (Array.isArray(queryContext.dislikedIngredients) && queryContext.dislikedIngredients.length > 0) {
                    queryContext.dislikedIngredients.forEach(ingredient => {
                        const ingLower = ingredient.toLowerCase();
                        if (titleLower.includes(ingLower) || descLower.includes(ingLower) || pKeywords.includes(ingLower)) {
                            preferenceScore -= 0.4;
                        }
                    });
                }
            }
            preferenceScore = Math.min(1.0, Math.max(0.0, preferenceScore));

            // --- 5. REVIEW QUALITY (10%) ---
            const rating = Number(product.rating || 4.0);
            const ratingNormalized = Math.min(5.0, Math.max(0, rating)) / 5.0;
            const trustScore = Number(product.trust_score || 80);
            const trustNormalized = Math.min(100, Math.max(0, trustScore)) / 100.0;
            const reviewQualityScore = (0.6 * ratingNormalized) + (0.4 * trustNormalized);

            // Compute composite score
            const finalScore = (0.40 * semanticScore) +
                               (0.25 * keywordScore) +
                               (0.15 * popularityScore) +
                               (0.10 * preferenceScore) +
                               (0.10 * reviewQualityScore);

            return {
                ...product,
                rankingScore: parseFloat(finalScore.toFixed(4)),
                breakdown: {
                    semanticScore: parseFloat(semanticScore.toFixed(2)),
                    keywordScore: parseFloat(keywordScore.toFixed(2)),
                    popularityScore: parseFloat(popularityScore.toFixed(2)),
                    preferenceScore: parseFloat(preferenceScore.toFixed(2)),
                    reviewQualityScore: parseFloat(reviewQualityScore.toFixed(2))
                }
            };
        });

        // 3. Sort by rankingScore descending
        return scoredProducts.sort((a, b) => b.rankingScore - a.rankingScore);
    }
};
