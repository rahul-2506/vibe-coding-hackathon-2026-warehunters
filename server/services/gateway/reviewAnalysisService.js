import { supabase } from '../../db.js';
import { fakeReviewDetector } from './fakeReviewDetector.js';
import { logger } from '../../utils/logger.js';

export const reviewAnalysisService = {
    /**
     * Conducts a detailed clinical analysis on a single review submission.
     * @param {Object} payload Review submission details
     * @returns {Object} Review analysis results scorecard
     */
    async analyzeReview(payload) {
        const text = payload.review_text || payload.review || '';
        const rating = Number(payload.rating);
        const prodName = payload.product_name || 'Generic Product';
        const mood = payload.experience_mood || '😐 Neutral';
        const confidence = payload.confidence_score || 50;

        logger.info(`[REVIEW ANALYSIS SERVICE] Auditing submission for: "${prodName}"`, 'AI_GATEWAY');

        // Fetch past reviews for duplication check
        let pastReviews = [];
        try {
            const { data: matchedProds } = await supabase
                .from('products')
                .select('id')
                .or(`title.eq."${prodName}",name.eq."${prodName}"`)
                .limit(1);

            if (matchedProds && matchedProds.length > 0) {
                const prodId = matchedProds[0].id;
                const { data: revs } = await supabase
                    .from('reviews')
                    .select('*')
                    .eq('product_id', prodId)
                    .limit(5);
                if (revs) pastReviews = revs;
            }
        } catch (err) {
            logger.warn(`[REVIEW ANALYSIS SERVICE] Failed to fetch product reviews for duplication: ${err.message}`, 'AI_GATEWAY');
        }

        // Run detection audit
        const detectorResult = fakeReviewDetector.detectFakeReview(
            { review_text: text, rating, experience_mood: mood },
            pastReviews
        );

        // Calculate Specificity Index
        const words = text.toLowerCase().split(/\s+/);
        const skincareKeywords = new Set(['pore', 'skin', 'acne', 'hydration', 'salicylic', 'neem', 'barrier', 'oil', 'breakout', 'dry', 'moisture', 'ubtan']);
        const techKeywords = new Set(['battery', 'screen', 'performance', 'speed', 'cpu', 'thermal', 'ram', 'display', 'charge', 'speaker']);
        
        const matchedSpecific = words.filter(w => skincareKeywords.has(w) || techKeywords.has(w));
        let specificityScore = Math.min(100, matchedSpecific.length * 25 + (text.length > 50 ? 30 : 10));
        
        if (detectorResult.breakdown.vagueContent) {
            specificityScore = 15;
        }

        // Calculate Relevance Score
        let relevanceScore = 30;
        const prodWords = new Set(prodName.toLowerCase().split(/\s+/));
        const matchesProdWords = words.filter(w => prodWords.has(w));
        
        if (matchesProdWords.length > 0 || matchedSpecific.length > 0) {
            relevanceScore = Math.min(100, relevanceScore + 50 + matchesProdWords.length * 10);
        }
        if (detectorResult.breakdown.vagueContent) {
            relevanceScore = 25;
        }

        // Calculate Detail Richness
        let detailScore = Math.min(100, Math.floor(text.length * 0.4) + (payload.highlight_categories?.length || 0) * 10);
        if (detectorResult.breakdown.vagueContent) {
            detailScore = 20;
        }

        // Sentiment Consistency
        const consistencyScore = detectorResult.breakdown.sentimentMismatch ? 40 : 100;

        // Reviewer Reputation calculations
        let prevReputation = 50;
        if (payload.user_id) {
            try {
                const { data: userRevs } = await supabase
                    .from('reviews')
                    .select('reviewer_score')
                    .eq('user_id', payload.user_id)
                    .limit(1);
                
                if (userRevs && userRevs.length > 0 && userRevs[0].reviewer_score !== undefined) {
                    prevReputation = userRevs[0].reviewer_score;
                }
            } catch (e) {
                // ignore
            }
        }

        const delta = detectorResult.verdict === 'GENUINE' ? 5 : (detectorResult.verdict === 'LIKELY_FAKE' ? -10 : 0);
        const newReputation = Math.max(0, Math.min(100, prevReputation + delta));

        let trustScore = detectorResult.authenticityScore;
        if (payload.image_url && payload.image_url.trim().length > 0) {
            trustScore = Math.min(100, trustScore + 5);
        }

        return {
            trust_score: trustScore,
            classification: detectorResult.verdict,
            ml_explanation: detectorResult.explanation,
            ai_confidence: detectorResult.reviewConfidence,
            reviewer_score: newReputation,
            analysis_breakdown: {
                specificity: Math.round(specificityScore),
                relevance: Math.round(relevanceScore),
                consistency: Math.round(consistencyScore),
                detail_richness: Math.round(detailScore),
                spam_risk: Math.round(detectorResult.spamProbability)
            }
        };
    }
};
