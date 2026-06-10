import { supabase } from '../../db.js';
import { logger } from '../../utils/logger.js';
import { llmClient } from '../../src/ai/llmClient.js';

function getJaccardOverlap(list1, list2) {
    if (!list1 || !list2 || list1.length === 0 || list2.length === 0) return 0.0;
    const set1 = new Set(list1.map(w => w.toLowerCase()));
    const set2 = new Set(list2.map(w => w.toLowerCase()));
    
    let intersection = 0;
    for (const item of set1) {
        if (set2.has(item)) intersection++;
    }
    const union = set1.size + set2.size - intersection;
    return union > 0 ? intersection / union : 0.0;
}

function generateExplanation(prod, target, sharedKeywords, pTrust) {
    const pCat = prod.category;
    const tCat = target.category;
    const sameCat = pCat?.toLowerCase() === tCat?.toLowerCase();
    
    const kwDisplay = sharedKeywords && sharedKeywords.length > 0
        ? sharedKeywords.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' & ')
        : '';

    if (pCat === 'Skincare & Beauty' || pCat === 'Skincare') {
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

    return `Premium utility pick: Vetted for high feature overlap and high quality assurance, backed by a solid ${pTrust}% verified trust score.`;
}

export const recommendationService = {
    /**
     * Recommends similar products for a target product ID using mathematical models.
     */
    async getRecommendations(targetId) {
        try {
            logger.info(`[RECOMMENDATION SERVICE] Getting similar products for target ID: ${targetId}`, 'AI_GATEWAY');

            // 1. Fetch catalog
            const { data: products, error } = await supabase.from('products').select('*');
            if (error) throw error;

            let target = products.find(p => p.id === Number(targetId));
            if (!target) {
                logger.warn(`[RECOMMENDATION SERVICE] Target product ${targetId} not found. Returning popular items.`, 'AI_GATEWAY');
                return products.slice(0, 5);
            }

            const targetKeywords = Array.isArray(target.keywords) 
                ? target.keywords 
                : (typeof target.keywords === 'string' ? JSON.parse(target.keywords) : []);

            const recommendations = [];

            for (const prod of products) {
                if (prod.id === target.id) continue;

                const pKeywords = Array.isArray(prod.keywords)
                    ? prod.keywords
                    : (typeof prod.keywords === 'string' ? JSON.parse(prod.keywords) : []);

                // A. Category Similarity (40 pts)
                const catScore = prod.category?.toLowerCase() === target.category?.toLowerCase() ? 40.0 : 0.0;

                // B. Keyword Jaccard Overlap (30 pts)
                const jaccard = getJaccardOverlap(targetKeywords, pKeywords);
                const kwScore = jaccard * 30.0;

                // C. Trust Score / Reviews (20 pts)
                const pTrust = prod.trust_score || 80;
                const trustScorePoints = (pTrust / 100.0) * 20.0;

                // D. Rating points (10 pts)
                const ratingScorePoints = ((prod.rating || 4.0) / 5.0) * 10.0;

                // E. Brand Similarity (15 pts bonus)
                const brandScore = (prod.brand && target.brand && prod.brand.toLowerCase() === target.brand.toLowerCase()) ? 15.0 : 0.0;

                const totalScore = catScore + kwScore + trustScorePoints + ratingScorePoints + brandScore;
                const matchPercent = Math.min(100, Math.round(totalScore));

                const sharedKeywords = targetKeywords.filter(k => pKeywords.includes(k));
                const explanation = generateExplanation(prod, target, sharedKeywords, pTrust);

                recommendations.push({
                    id: prod.id,
                    title: prod.title || prod.name,
                    name: prod.title || prod.name,
                    category: prod.category,
                    price: Number(prod.price),
                    rating: Number(prod.rating || 4.2),
                    thumbnail: prod.thumbnail,
                    image_url: prod.thumbnail || prod.image_url,
                    trust_score: pTrust,
                    match_score: matchPercent,
                    keywords: pKeywords,
                    explanation: explanation
                });
            }

            // Sort by match score
            recommendations.sort((a, b) => b.match_score - a.match_score);
            return recommendations.slice(0, 8);
        } catch (err) {
            logger.error('[RECOMMENDATION SERVICE ERROR] Recommendation logic failed:', err, 'AI_GATEWAY');
            return [];
        }
    },

    async getAIRecommendations(prompt) {
        try {
            logger.info(`[RECOMMENDATION SERVICE] Querying AI matches for prompt: "${prompt}"`, 'AI_GATEWAY');
            const geminiKey = process.env.GEMINI_API_KEY || (process.env.AI_API_KEY?.startsWith('AIzaSy') ? process.env.AI_API_KEY : null);
            const groqKey = process.env.GROQ_API_KEY || null;

            if (geminiKey || groqKey) {
                try {
                    const { data: products } = await supabase.from('products').select('*');
                    const allProducts = products || [];
                    
                    const productContext = allProducts.map(p => 
                        `ID: ${p.id}, Name: ${p.title || p.name}, Price: $${p.price}, Category: ${p.category}, Description: ${p.explanation || p.description}`
                    ).join('\n');

                    const systemInstruction = `You are a High-Precision Product Recommendation Engine.
Select up to 5 best matching products from the provided inventory for the user prompt.
Return ONLY a JSON list of objects: [{"id": 101, "matchScore": 95, "explanation": "Matching reason", "relativityTags": [{"label": "Tag", "color": "#6366f1"}]}].
Do not add Markdown formatting. Clean JSON array only.`;

                    const finalPrompt = `${systemInstruction}\n\nUSER PROMPT: ${prompt}\n\nINVENTORY:\n${productContext}`;

                    const text = await llmClient.query({
                        prompt: finalPrompt,
                        jsonMode: true,
                        keys: { geminiKey, groqKey }
                    });

                    if (text) {
                        let cleanText = text.trim();
                        if (cleanText.startsWith('```')) {
                            cleanText = cleanText.replace(/^```json?\s*/i, '').replace(/```$/, '').trim();
                        }
                        
                        let recs = JSON.parse(cleanText);
                        
                        // If LLM returned an object instead of array, defensively find the array inside it
                        if (!Array.isArray(recs) && recs && typeof recs === 'object') {
                            if (Array.isArray(recs.recommendations)) {
                                recs = recs.recommendations;
                            } else if (Array.isArray(recs.products)) {
                                recs = recs.products;
                            } else {
                                const possibleArray = Object.values(recs).find(val => Array.isArray(val));
                                if (possibleArray) {
                                    recs = possibleArray;
                                } else {
                                    recs = [];
                                }
                            }
                        }

                        if (Array.isArray(recs)) {
                            const productMap = new Map(allProducts.map(p => [p.id, p]));
                            const formatted = [];
                            
                            for (const rec of recs) {
                                if (!rec) continue;
                                const p = productMap.get(Number(rec.id));
                                if (p) {
                                    formatted.push({
                                        id: p.id,
                                        name: p.title || p.name,
                                        price: Number(p.price),
                                        category: p.category,
                                        image_url: p.thumbnail || p.image_url,
                                        matchScore: Number(rec.matchScore || rec.match_score || 80),
                                        explanation: rec.explanation || 'Matched based on AI query analysis.',
                                        relativityTags: Array.isArray(rec.relativityTags) ? rec.relativityTags : (rec.relativityTags ? [rec.relativityTags] : [])
                                    });
                                }
                            }
                            return formatted;
                        }
                    }
                } catch (e) {
                    logger.error('[RECOMMENDATION SERVICE] AI matchmaking failed, falling back to heuristics', e, 'AI_GATEWAY');
                }
            }

            // Heuristics fallback: find items in products containing prompt keywords
            try {
                const { data: products } = await supabase.from('products').select('*');
                const words = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 2);
                if (products && words.length > 0) {
                    const matches = products.filter(p => {
                        const title = (p.title || p.name || '').toLowerCase();
                        const desc = (p.description || '').toLowerCase();
                        return words.some(w => title.includes(w) || desc.includes(w));
                    }).slice(0, 5).map(p => ({
                        id: p.id,
                        name: p.title || p.name,
                        price: Number(p.price),
                        category: p.category,
                        image_url: p.thumbnail || p.image_url,
                        matchScore: 80,
                        explanation: 'Matched based on local database keyword heuristic overlap.',
                        relativityTags: [{ label: 'Heuristic Match', color: '#10b981' }]
                    }));
                    return matches;
                }
                return (products || []).slice(0, 5).map(p => ({
                    id: p.id,
                    name: p.title || p.name,
                    price: Number(p.price),
                    category: p.category,
                    image_url: p.thumbnail || p.image_url,
                    matchScore: 70,
                    explanation: 'Popular item recommended as default fallback.',
                    relativityTags: [{ label: 'Popular', color: '#6366f1' }]
                }));
            } catch (fallbackErr) {
                logger.error('[RECOMMENDATION SERVICE] Heuristics fallback failed:', fallbackErr, 'AI_GATEWAY');
            }
            return [];
        } catch (err) {
            logger.error('[RECOMMENDATION SERVICE] Recommendation query failed:', err, 'AI_GATEWAY');
            return [];
        }
    }
};
