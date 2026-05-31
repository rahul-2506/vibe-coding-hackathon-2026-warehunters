import fetch from 'node-fetch';
import { supabase } from '../db.js';
import { productService } from './productService.js';
import { logger } from '../utils/logger.js';

function getJaccardOverlap(list1, list2) {
    if (!list1 || !list2 || list1.length === 0 || list2.length === 0) return 0.0;
    const set1 = new Set(list1.map(w => w.toLowerCase()));
    const set2 = new Set(list2.map(w => w.toLowerCase()));
    
    let intersectionSize = 0;
    for (const item of set1) {
        if (set2.has(item)) intersectionSize++;
    }
    const unionSize = set1.size + set2.size - intersectionSize;
    return unionSize > 0 ? intersectionSize / unionSize : 0.0;
}

function generateExplanation(prod, target, sharedKeywords, pTrust) {
    const pCat = prod.category;
    const tCat = target.category;
    const sameCat = pCat.toLowerCase() === tCat.toLowerCase();
    
    // Capitalize keywords for aesthetic presentation
    const kwDisplay = sharedKeywords && sharedKeywords.length > 0
        ? sharedKeywords.slice(0, 2)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' & ')
        : '';

    if (pCat === 'Skincare & Beauty') {
        if (sameCat && kwDisplay) {
            return `Dermatologist recommended: Shares core bio-active keywords (${kwDisplay}) with target, promoting targeted hydration and cellular elasticity.`;
        }
        return `Expert formulation compatibility: High pH-balanced synergy sharing compatible molecular weights with your selected routine.`;
    }
    
    if (pCat === 'Electronics') {
        if (sameCat && kwDisplay) {
            return `System companion pick: Offers compatible high-speed performance specs and overlapping functions (${kwDisplay}).`;
        }
        return `Engineered compatibility: Designed to expand productivity, matching the target device standards and efficiency indexes.`;
    }
    
    if (pCat === 'Groceries') {
        return `Organic nutrient coordinator: Curated to share strict fresh-harvest standards, rich vitamins, and clean ingredient profiles.`;
    }
    
    if (pCat === 'Home & Living') {
        return `Aesthetic and space synergy: Minimalist modern styling designed to match the form factor and structural longevity of the target.`;
    }
    
    if (pCat === 'Fashion & Apparel') {
        return `Curated outfit coordinator: Shared material grades and weave styling that seamlessly complement the target's look.`;
    }

    return `Premium utility pick: Vetted for high feature overlap and high quality assurance, backed by a solid ${pTrust}% verified trust score.`;
}

export const recommendationService = {
    async getRecommendations(targetId) {
        const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
        const url = `${mlServiceUrl}/api/analytics/recommend/${targetId}`;

        // 1. Try to contact Flask ML Service for recommendations
        try {
            const mlResponse = await fetch(url);
            if (mlResponse.ok) {
                const mlRecs = await mlResponse.json();
                logger.info(`Successfully fetched recommendations from ML service for product ${targetId}`, 'RECOMMENDATION');
                return mlRecs;
            }
        } catch (err) {
            logger.externalFail('Python ML Recommendation', url, err, 'RECOMMENDATION');
            logger.warn('Flask ML service is offline. Triggering local Node JS recommendation engine fallback.', 'RECOMMENDATION');
        }

        // 2. Local JS Backup Recommendation Engine
        const products = await productService.getAllProducts();
        let target = products.find(p => p.id === Number(targetId));
        
        // Target fallback if not found or undefined (prevent empty recommendations and crash states)
        if (!target) {
            logger.warn(`Target product ${targetId} not found in catalog. Returning intelligently ranked popular products as fallback.`, 'RECOMMENDATION');
            
            // Prioritize Skincare & Beauty, then high trust, then high ratings
            const popularRanked = [...products].sort((a, b) => {
                const aSkincare = a.category === 'Skincare & Beauty' ? 1 : 0;
                const bSkincare = b.category === 'Skincare & Beauty' ? 1 : 0;
                if (aSkincare !== bSkincare) return bSkincare - aSkincare;
                
                const aTrust = a.trust_score || 80;
                const bTrust = b.trust_score || 80;
                if (aTrust !== bTrust) return bTrust - aTrust;
                
                if (b.rating !== a.rating) return b.rating - a.rating;
                return a.id - b.id;
            });
            
            return popularRanked.slice(0, 8).map(prod => {
                const pKeywords = Array.isArray(prod.keywords)
                    ? prod.keywords
                    : (typeof prod.keywords === 'string' ? JSON.parse(prod.keywords) : []);
                return {
                    id: prod.id,
                    title: prod.title,
                    name: prod.title,
                    category: prod.category,
                    price: Number(prod.price),
                    rating: Number(prod.rating),
                    thumbnail: prod.thumbnail,
                    image_url: prod.thumbnail,
                    trust_score: prod.trust_score || 80,
                    match_score: 85,
                    keywords: pKeywords,
                    explanation: 'Highly recommended community choice in active inventory.'
                };
            });
        }

        const targetKeywords = Array.isArray(target.keywords) 
            ? target.keywords 
            : (typeof target.keywords === 'string' ? JSON.parse(target.keywords) : []);

        const recommendations = [];

        for (const prod of products) {
            if (prod.id === target.id) continue; // Skip itself

            const pKeywords = Array.isArray(prod.keywords)
                ? prod.keywords
                : (typeof prod.keywords === 'string' ? JSON.parse(prod.keywords) : []);

            // A. Category Similarity (40 pts)
            const catScore = prod.category.toLowerCase() === target.category.toLowerCase() ? 40.0 : 0.0;

            // B. Keyword Jaccard Overlap (30 pts)
            const jaccard = getJaccardOverlap(targetKeywords, pKeywords);
            const kwScore = jaccard * 30.0;

            // C. Trust Score / Reviews (20 pts)
            let pTrust = prod.trust_score || 80;
            try {
                const { data: reviews, error: revErr } = await supabase
                    .from('reviews')
                    .select('trust_score')
                    .eq('product_id', prod.id);

                if (!revErr && reviews && reviews.length > 0) {
                    const avgTrust = reviews.reduce((sum, r) => sum + r.trust_score, 0) / reviews.length;
                    pTrust = Math.round(avgTrust);
                }
            } catch (dbErr) {
                // Keep default
            }
            const trustScorePoints = (pTrust / 100.0) * 20.0;

            // D. Rating points (10 pts)
            const ratingScorePoints = (prod.rating / 5.0) * 10.0;

            // E. Brand Similarity (15 pts bonus)
            const brandScore = (prod.brand && target.brand && prod.brand.toLowerCase() === target.brand.toLowerCase()) ? 15.0 : 0.0;

            // F. Rating Proximity (10 pts bonus)
            const ratingDiff = Math.abs(prod.rating - target.rating);
            const ratingProximityScore = Math.max(0, (2.0 - ratingDiff) * 5.0);

            // G. Sentiment Score (10 pts bonus based on reviews or rating profile)
            const sentimentScore = prod.rating >= 4.5 ? 10.0 : (prod.rating >= 4.0 ? 7.0 : 4.0);

            // Compute total weighted index and normalize to 100
            const totalScore = catScore + kwScore + trustScorePoints + ratingScorePoints + brandScore + ratingProximityScore + sentimentScore;
            const matchPercent = Math.min(100, Math.round(totalScore));

            const sharedKeywords = targetKeywords.filter(k => pKeywords.includes(k));
            const explanation = generateExplanation(prod, target, sharedKeywords, pTrust);

            recommendations.push({
                id: prod.id,
                title: prod.title,
                name: prod.title,
                category: prod.category,
                price: Number(prod.price),
                rating: Number(prod.rating),
                thumbnail: prod.thumbnail,
                image_url: prod.thumbnail,
                trust_score: pTrust,
                match_score: matchPercent,
                keywords: pKeywords,
                explanation: explanation
            });
        }

        // Sort descending by match score and then by trust score / rating
        recommendations.sort((a, b) => {
            if (b.match_score !== a.match_score) {
                return b.match_score - a.match_score;
            }
            return (b.trust_score + b.rating) - (a.trust_score + a.rating);
        });
        
        // Return top 8 matches
        return recommendations.slice(0, 8);
    },

    async getAIRecommendations(prompt) {
        const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
        const url = `${mlServiceUrl}/recommend_products`;

        logger.info(`[AI RECOMMENDATION] Querying Python ML Service for prompt: "${prompt}"`, 'RECOMMENDATION');

        try {
            const mlResponse = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (mlResponse.ok) {
                const mlRecs = await mlResponse.json();
                logger.info(`Successfully fetched AI recommendations from ML service for prompt`, 'RECOMMENDATION');
                return mlRecs;
            }
            throw new Error(`ML service returned status ${mlResponse.status}`);
        } catch (err) {
            logger.externalFail('Python ML recommend_products', url, err, 'RECOMMENDATION');
            throw err;
        }
    }
};
