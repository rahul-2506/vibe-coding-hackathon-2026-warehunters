import { supabase, supabaseAdmin } from '../db.js';
import { logger } from '../utils/logger.js';
import { aiGateway } from './gateway/aiGateway.js';
import fetch from 'node-fetch';

export const feedbackService = {
    async submitFeedback(feedbackPayload) {
        const { 
            product_name, rating, review_text, emoji, source, mentioned_ingredients, user_id,
            experience_mood, highlight_categories, recommendation, discovery_source, confidence_score, image_url
        } = feedbackPayload;

        const text = review_text || '';
        const userRating = parseInt(rating, 10);
        
        // Phase 5 defaults for interactive options
        const mood = experience_mood || '😐 Neutral';
        const highlights = Array.isArray(highlight_categories) ? highlight_categories : [];
        const rec = recommendation || '🤔 Maybe';
        const discovery = discovery_source || 'Own Research';
        const confScore = confidence_score !== undefined ? parseInt(confidence_score, 10) : 100;
        const imgUrl = image_url || '';

        // 1. Audit review using the centralized AI Gateway review analysis service
        let trust_score = 75;
        let classification = 'GENUINE';
        let ml_explanation = 'Genuine review with solid user-reported confidence.';
        let ai_confidence = 80;
        let reviewer_score = 50;
        let analysis_breakdown = {
            specificity: 75,
            relevance: 80,
            consistency: 90,
            detail_richness: 70,
            spam_risk: 10
        };

        try {
            const analysisResult = await aiGateway.reviewAnalysis.analyzeReview({
                product_name,
                rating: userRating,
                review_text: text,
                experience_mood: mood,
                highlight_categories: highlights,
                recommendation: rec,
                discovery_source: discovery,
                confidence_score: confScore,
                image_url: imgUrl,
                user_id: user_id || null
            });

            trust_score = analysisResult.trust_score;
            classification = analysisResult.classification;
            ml_explanation = analysisResult.ml_explanation;
            ai_confidence = analysisResult.ai_confidence;
            reviewer_score = analysisResult.reviewer_score;
            analysis_breakdown = analysisResult.analysis_breakdown;
            logger.info(`[feedbackService] Review audited successfully. Trust: ${trust_score}%, Verdict: ${classification}`, 'FEEDBACK');
        } catch (err) {
            logger.error(`[feedbackService Error] Gateway review analysis failed: ${err.message}`, err, 'FEEDBACK');
        }

        const isPublic = classification !== 'LIKELY_FAKE';

        // 2. Resolve Product ID
        let productId = null;
        try {
            const { data: products, error: prodErr } = await supabase
                .from('products')
                .select('id')
                .eq('title', product_name)
                .limit(1);

            if (!prodErr && products && products.length > 0) {
                productId = products[0].id;
            }
        } catch (err) {
            logger.warn(`Could not resolve product ID for: ${product_name}`, 'FEEDBACK');
        }

        const isValidUUID = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        const safeUserId = isValidUUID(user_id) ? user_id : null;

        // 3. Insert direct into standard public.reviews table
        try {
            const reviewRow = {
                product_id: productId,
                product_name: product_name,
                rating: userRating,
                review_text: text,
                emoji: emoji,
                source: source,
                mentioned_ingredients: mentioned_ingredients,
                user_id: safeUserId,
                is_public: isPublic,
                sentiment: userRating >= 4 ? 'positive' : (userRating <= 2 ? 'negative' : 'neutral'),
                
                // Phase 5 specific columns
                experience_mood: mood,
                highlight_categories: highlights,
                recommendation: rec,
                discovery_source: discovery,
                confidence_score: confScore,
                image_url: imgUrl,
                classification: classification,
                ml_explanation: ml_explanation,
                ai_confidence: ai_confidence,
                trust_score: trust_score,
                authenticity_score: trust_score,
                analysis_breakdown: analysis_breakdown,
                reviewer_score: reviewer_score
            };

            const { error: insErr } = await supabaseAdmin.from('reviews').insert(reviewRow);
            if (insErr) {
                // If column mismatch occurs on unmigrated Supabase DB, fallback to legacy schema inserts
                logger.warn(`Supabase insert failed with: ${insErr.message}. Retrying with legacy columns fallback.`, 'FEEDBACK');
                const legacyRow = {
                    product_id: productId,
                    rating: userRating,
                    review_text: text,
                    trust_score: trust_score,
                    verdict: classification === 'GENUINE' ? 'Genuine' : (classification === 'LIKELY_FAKE' ? 'Fake' : 'Suspicious'),
                    user_id: safeUserId,
                    sentiment: userRating >= 4 ? 'positive' : (userRating <= 2 ? 'negative' : 'neutral')
                };
                const { error: fallbackErr } = await supabaseAdmin.from('reviews').insert(legacyRow);
                if (fallbackErr) throw fallbackErr;
            } else {
                logger.info(`Successfully stored Phase 5 review into public.reviews. Trust: ${trust_score}%`, 'FEEDBACK');
            }
        } catch (err) {
            logger.error('Failed to submit consolidated review to public.reviews:', err, 'FEEDBACK');
            throw err;
        }

        return { 
            verdict: classification === 'GENUINE' ? 'Genuine' : (classification === 'LIKELY_FAKE' ? 'Fake' : 'Suspicious'),
            trust_score,
            classification,
            ml_explanation,
            ai_confidence,
            reviewer_score,
            analysis_breakdown
        };
    },

    async getAllPublicFeedbacks() {
        try {
            // Fetch verified reviews from public.reviews instead of feedbacks
            const { data, error } = await supabase
                .from('reviews')
                .select('*')
                .neq('verdict', 'Fake')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (err) {
            logger.error('Failed to fetch public reviews for feedback feed:', err, 'FEEDBACK');
            return [];
        }
    },

    async getUserFeedbacks(userId) {
        try {
            // Fetch user reviews from public.reviews instead of feedbacks
            const { data, error } = await supabase
                .from('reviews')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (err) {
            logger.error(`Failed to fetch reviews for user ${userId}:`, err, 'FEEDBACK');
            return [];
        }
    }
};
