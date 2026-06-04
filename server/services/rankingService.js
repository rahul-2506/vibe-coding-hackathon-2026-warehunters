/**
 * Product Ranking Service
 * Ranks a list of products using the weighted formula:
 * score = 0.4 * ratingNormalized + 0.3 * reviewCountNormalized + 0.2 * relevanceScore + 0.1 * valueScore
 */
export const rankingService = {
    rankProducts(products, relevanceScoresMap = new Map(), queryContext = null) {
        if (!Array.isArray(products) || products.length === 0) {
            return [];
        }

        // 1. Find max review count to normalize
        let maxReviewCount = 0;
        products.forEach(p => {
            const count = p.review_count || p.reviews_count || 0;
            if (count > maxReviewCount) {
                maxReviewCount = count;
            }
        });

        // 2. Score and rank each product
        const scoredProducts = products.map(product => {
            const idKey = String(product.id);
            
            // Normalized Rating (0 to 1)
            const rating = Number(product.rating) || 4.0;
            const ratingNormalized = Math.min(5.0, Math.max(0, rating)) / 5.0;

            // Normalized Review Count (0 to 1)
            const reviewCount = Number(product.review_count || product.reviews_count || 0);
            const reviewCountNormalized = maxReviewCount > 0 ? (reviewCount / maxReviewCount) : 0.5;

            // Relevance Score (0 to 1)
            let relevanceScore = relevanceScoresMap.has(idKey) 
                ? Number(relevanceScoresMap.get(idKey)) 
                : 0.5; // default relevance
            
            // If the query context specifies a budget and product is within budget, boost relevance
            if (queryContext && queryContext.budget) {
                const budget = Number(queryContext.budget);
                const price = Number(product.price);
                if (price <= budget) {
                    relevanceScore = Math.min(1.0, relevanceScore + 0.15); // budget suitability bonus
                } else {
                    relevanceScore = Math.max(0.0, relevanceScore - 0.2); // over-budget penalty
                }
            }

            // Value Score (0 to 1)
            // Measures how much of a deal it is (original_price vs price)
            const price = Number(product.price) || 0;
            const originalPrice = Number(product.original_price) || price;
            let valueScore = 0.5; // default if no discount
            
            if (originalPrice > price) {
                valueScore = 1 - (price / originalPrice); // higher discount = higher score
            } else if (originalPrice > 0) {
                // If price is lower, check relative affordability (cheaper products in same category get slightly higher value score)
                valueScore = Math.min(1.0, Math.max(0.1, 1 - (price / 500))); // relative value for budget options
            }

            // Calculate final composite score
            const score = (0.4 * ratingNormalized) + 
                          (0.3 * reviewCountNormalized) + 
                          (0.2 * relevanceScore) + 
                          (0.1 * valueScore);

            return {
                ...product,
                rankingScore: parseFloat(score.toFixed(4)),
                breakdown: {
                    ratingNormalized: parseFloat(ratingNormalized.toFixed(2)),
                    reviewCountNormalized: parseFloat(reviewCountNormalized.toFixed(2)),
                    relevanceScore: parseFloat(relevanceScore.toFixed(2)),
                    valueScore: parseFloat(valueScore.toFixed(2))
                }
            };
        });

        // 3. Sort by score descending
        return scoredProducts.sort((a, b) => b.rankingScore - a.rankingScore);
    }
};
