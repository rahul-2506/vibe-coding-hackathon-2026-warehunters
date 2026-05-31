import { supabase } from '../db.js';
import { logger } from '../utils/logger.js';
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

        // 1. Call FastAPI ML Service
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
            const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
            logger.info(`[feedbackService] Forwarding review payload to Python ML analyzer...`, 'FEEDBACK');
            const res = await fetch(`${mlServiceUrl}/analyze_review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
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
                })
            });

            if (res.ok) {
                const mlRes = await res.json();
                trust_score = mlRes.trust_score;
                classification = mlRes.classification;
                ml_explanation = mlRes.ml_explanation;
                ai_confidence = mlRes.ai_confidence;
                reviewer_score = mlRes.reviewer_score;
                analysis_breakdown = mlRes.analysis_breakdown;
                logger.info(`[feedbackService] FastAPI Analysis succeeded. Trust: ${trust_score}% Verdict: ${classification}`, 'FEEDBACK');
            } else {
                throw new Error(`FastAPI returned status: ${res.status}`);
            }
        } catch (err) {
            logger.warn(`[feedbackService WARNING] FastAPI analyzer unavailable, falling back to local deterministic checks: ${err.message}`, 'FEEDBACK');
            
            // Failsafe local deterministic scoring
            const textLower = text.toLowerCase();
            const posWords = ['good', 'great', 'love', 'best', 'effective', 'amazing', 'happy', 'glow', 'clear', 'worked', 'result'];
            const negWords = ['bad', 'worst', 'waste', 'breakout', 'pimple', 'scam', 'hate', 'oily', 'dry', 'irritation', 'expensive'];
            
            let sentiment = 'neutral';
            const posCount = posWords.filter(w => textLower.includes(w)).length;
            const negCount = negWords.filter(w => textLower.includes(w)).length;
            if (posCount > negCount) sentiment = 'positive';
            else if (negCount > posCount) sentiment = 'negative';

            let consistencyFlag = false;
            if (userRating >= 4 && sentiment === 'negative') consistencyFlag = true;
            if (userRating <= 2 && sentiment === 'positive') consistencyFlag = true;

            const posEmojis = ['😊', '😍', '👍', '✨', '💖'];
            const negEmojis = ['😡', '👎', '😠', '😣', '💀'];
            if (sentiment === 'positive' && negEmojis.includes(emoji)) consistencyFlag = true;
            if (sentiment === 'negative' && posEmojis.includes(emoji)) consistencyFlag = true;

            let scientificScore = 0;
            const matchedSpecific = skincare_keywords_check(textLower);
            if (matchedSpecific >= 3) scientificScore = 40;
            else if (matchedSpecific >= 1) scientificScore = 20;

            let sourceScore = 0;
            if (source === 'dermatologist') sourceScore = 30;
            else if (source === 'self') sourceScore = 20;
            
            let penalties = 0;
            if (consistencyFlag) penalties += 15; // Mismatch penalty
            if (text.length < 15) penalties += 25;
            else if (text.length < 40) penalties += 10;

            let imageBonus = 0;
            if (imgUrl && matchedSpecific >= 1) imageBonus = 5;

            let localScore = 75 + sourceScore + scientificScore + imageBonus - penalties;
            trust_score = Math.max(0, Math.min(100, localScore));

            const isVague = text.length < 25;

            if (isVague) {
                classification = 'SUSPICIOUS';
                ml_explanation = 'Review lacks specific details about product experience.';
                trust_score = Math.min(45, trust_score);
            } else if (consistencyFlag) {
                classification = 'SUSPICIOUS';
                ml_explanation = 'Mood selection conflicts with review text.';
            } else if (trust_score >= 75) {
                classification = 'GENUINE';
                ml_explanation = 'Genuine review containing specific product observations and balanced sentiment.';
            } else if (trust_score >= 40) {
                classification = 'SUSPICIOUS';
                ml_explanation = 'Suspicious review due to generic vocabulary or limited product relevance.';
            } else {
                classification = 'LIKELY_FAKE';
                ml_explanation = 'Likely fake review due to extreme spam risk or low character density.';
            }

            ai_confidence = 75;
            reviewer_score = 50;
            analysis_breakdown = {
                specificity: matchedSpecific >= 2 ? 80 : 40,
                relevance: matchedSpecific >= 1 ? 85 : 50,
                consistency: consistencyFlag ? 40 : 100,
                detail_richness: Math.min(100, Math.round(text.length * 0.5)),
                spam_risk: isVague ? 30 : 10
            };
        }

        // Helper function for failsafe keywords
        function skincare_keywords_check(str) {
            const keywords = ['pore', 'skin', 'acne', 'hydration', 'salicylic', 'neem', 'barrier', 'oil', 'breakout', 'dry', 'moisture', 'ubtan', 'battery', 'screen', 'performance', 'speed'];
            return keywords.filter(k => str.includes(k)).length;
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
                user_id: user_id || null,
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

            const { error: insErr } = await supabase.from('reviews').insert(reviewRow);
            if (insErr) {
                // If column mismatch occurs on unmigrated Supabase DB, fallback to legacy schema inserts
                logger.warn(`Supabase insert failed with: ${insErr.message}. Retrying with legacy columns fallback.`, 'FEEDBACK');
                const legacyRow = {
                    product_id: productId,
                    rating: userRating,
                    review_text: text,
                    trust_score: trust_score,
                    verdict: classification === 'GENUINE' ? 'Genuine' : (classification === 'LIKELY_FAKE' ? 'Fake' : 'Suspicious'),
                    user_id: user_id || null,
                    sentiment: userRating >= 4 ? 'positive' : (userRating <= 2 ? 'negative' : 'neutral')
                };
                const { error: fallbackErr } = await supabase.from('reviews').insert(legacyRow);
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
