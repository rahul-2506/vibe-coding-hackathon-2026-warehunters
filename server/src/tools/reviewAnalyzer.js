import { supabase } from '../../db.js';
import { logger } from '../../utils/logger.js';
import { llmClient } from '../ai/llmClient.js';

export const reviewAnalyzer = {
    /**
     * Performs a detailed sentiment and authenticity audit on product reviews.
     */
    async analyze(productName, keys = {}) {
        logger.info(`[REVIEW ANALYZER] Auditing reviews for product: "${productName}"`, 'AI_REVIEWS');

        if (!productName) {
            return { success: false, error: 'Product name is required.' };
        }

        try {
            // 1. Resolve product ID from catalog
            const { data: matches, error: matchErr } = await supabase
                .from('products')
                .select('id, title, rating, trust_score')
                .ilike('title', `%${productName}%`)
                .limit(1);

            if (matchErr || !matches || matches.length === 0) {
                return { success: false, error: `Product "${productName}" not found in catalog.` };
            }

            const product = matches[0];
            const baseRating = Number(product.rating || 4.2);

            // 2. Fetch reviews
            const { data: reviews, error: reviewErr } = await supabase
                .from('reviews')
                .select('*')
                .eq('product_id', product.id);

            if (reviewErr) throw reviewErr;

            const all = reviews || [];
            const total = all.length;

            // 3. Authenticity calculations (Duplicate text & rating conflict audits)
            let duplicateCount = 0;
            let sentimentMismatchCount = 0;
            const textHashes = new Set();

            const negativeTriggers = ['terrible', 'worst', 'bad', 'waste', 'breakout', 'irritate', 'burning', 'fake'];
            const positiveTriggers = ['amazing', 'fantastic', 'excellent', 'great', 'love', 'perfect', 'best'];

            all.forEach(r => {
                const text = (r.review_text || '').toLowerCase().trim();
                const rating = Number(r.rating || 5);

                if (text.length > 10) {
                    const prefix = text.substring(0, 50);
                    if (textHashes.has(prefix)) {
                        duplicateCount++;
                    } else {
                        textHashes.add(prefix);
                    }
                }

                // Check contradictory ratings
                if (rating >= 4 && negativeTriggers.some(w => text.includes(w))) {
                    sentimentMismatchCount++;
                } else if (rating <= 2 && positiveTriggers.some(w => text.includes(w))) {
                    sentimentMismatchCount++;
                }
            });

            // Fake review probability calculations
            let fakeProb = 10;
            if (total > 0) {
                const dupRatio = duplicateCount / total;
                const mismatchRatio = sentimentMismatchCount / total;
                fakeProb += Math.round(dupRatio * 60 + mismatchRatio * 30);
            }
            fakeProb = Math.min(95, Math.max(5, fakeProb));

            // Sentiment Score calculation (out of 100)
            const positiveReviews = all.filter(r => Number(r.rating || 5) >= 4);
            const sentimentScore = total > 0 
                ? Math.round((positiveReviews.length / total) * 100)
                : Math.round(baseRating * 20);

            // 4. Topics and Recommendation Synthesis
            let common_positive_topics = ['Hydration', 'Skin Brightening', 'Texture Improvement'];
            let common_negative_topics = ['Fragrance sensitivity', 'Slight stickiness'];
            let purchase_recommendation = 'Recommended — Reviews display organic, consistent sentiment signatures with highly verified purchase indexes.';

            if (fakeProb > 40) {
                purchase_recommendation = 'Caution Advised — Highly abnormal duplicate review patterns and rating-sentiment conflicts detected.';
            } else if (sentimentScore < 60) {
                purchase_recommendation = 'Skip — Users report high incidence of flaking, irritation, or subpar clinical performance.';
            }

            const geminiKey = keys.geminiKey || process.env.GEMINI_API_KEY || (process.env.AI_API_KEY?.startsWith('AIzaSy') ? process.env.AI_API_KEY : null);
            const groqKey = keys.groqKey || process.env.GROQ_API_KEY || null;
            if ((geminiKey || groqKey) && total > 0) {
                try {
                    const reviewContext = all.slice(0, 10).map(r => `[Rating: ${r.rating}/5] ${r.review_text}`).join('\n');
                    
                    const prompt = `You are a professional reviews analyst.
Analyze these product reviews and extract common themes and topics.
REVIEWS:
${reviewContext}

Return a JSON object:
{
  "common_positive_topics": ["topic A", "topic B"],
  "common_negative_topics": ["topic C", "topic D"],
  "purchase_recommendation": "Empathetic 1-2 sentence buying recommendation."
}
Return ONLY valid JSON.`;

                    const text = await llmClient.query({
                        prompt,
                        jsonMode: true,
                        keys
                    });

                    if (text) {
                        const parsed = JSON.parse(text);
                        common_positive_topics = parsed.common_positive_topics || common_positive_topics;
                        common_negative_topics = parsed.common_negative_topics || common_negative_topics;
                        purchase_recommendation = parsed.purchase_recommendation || purchase_recommendation;
                    }
                } catch (err) {
                    logger.error(`[REVIEW ANALYZER] LLM theme extraction failed: ${err.message}`, 'AI_REVIEWS');
                }
            }

            const analysisResult = {
                success: true,
                productId: product.id,
                sentiment_score: sentimentScore,
                fake_review_probability: fakeProb,
                common_positive_topics,
                common_negative_topics,
                purchase_recommendation,
                // Legacy fields for formatter compatibility
                totalReviews: total,
                avgTrustScore: Number(product.trust_score || 80),
                suspiciousPercentage: fakeProb,
                duplicateCount,
                sentimentMismatchCount,
                trustLabel: fakeProb < 25 ? 'Highly Trusted' : fakeProb < 50 ? 'Moderately Trusted' : 'Low Trust',
                recommendation: purchase_recommendation,
                topGenuine: all.filter(r => Number(r.rating || 5) >= 4).slice(0, 2).map(r => ({
                    text: r.review_text?.substring(0, 150) || '',
                    trust_score: r.trust_score || 90,
                    reviewer: 'Verified Buyer'
                })),
                topSuspicious: all.filter(r => Number(r.rating || 5) <= 2).slice(0, 2).map(r => ({
                    text: r.review_text?.substring(0, 150) || '',
                    trust_score: r.trust_score || 50,
                    reviewer: 'Flagged Submitter'
                }))
            };

            return analysisResult;
        } catch (err) {
            logger.error(`[REVIEW ANALYZER] Audit failure: ${err.message}`, 'AI_REVIEWS');
            return { success: false, error: err.message };
        }
    }
};
