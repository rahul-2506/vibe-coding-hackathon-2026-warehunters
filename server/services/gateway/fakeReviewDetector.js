import { logger } from '../../utils/logger.js';

export const fakeReviewDetector = {
    /**
     * Evaluates a review's authenticity score and spam probability in real-time.
     * @param {Object} reviewData review object: { review_text, rating, experience_mood }
     * @param {Array} pastReviews batch of recent reviews for comparison to detect copypasta
     * @returns {Object} Compiled trust evaluation result
     */
    detectFakeReview(reviewData, pastReviews = []) {
        const text = (reviewData.review_text || reviewData.review || '').trim();
        const rating = Number(reviewData.rating);
        const mood = reviewData.experience_mood || '';

        logger.info(`[FAKE REVIEW DETECTOR] Auditing review text: "${text.substring(0, 40)}..."`, 'AI_GATEWAY');

        if (!text) {
            return {
                authenticityScore: 0,
                spamProbability: 100,
                botProbability: 100,
                humanProbability: 0,
                reviewConfidence: 100,
                verdict: 'SUSPICIOUS',
                explanation: 'Empty review text submitted.',
                breakdown: {
                    copypastaDetected: false,
                    highestJaccard: 0,
                    sentimentMismatch: false,
                    vagueContent: true,
                    insufficientData: false
                }
            };
        }

        // 1. Basic Tokenization and Clean-up
        const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        const uniqueWords = new Set(words);

        // 2. Check for Copypasta Jaccard Similarity against past reviews
        let jaccardOverlaps = 0;
        let highestOverlap = 0;
        const wordsSetForJaccard = new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 2));
        
        for (const prev of pastReviews) {
            const prevText = (prev.review_text || prev.review || '').trim();
            if (!prevText) continue;
            if (prev.id && reviewData.id && prev.id === reviewData.id) continue;

            const prevWords = new Set(prevText.toLowerCase().split(/\s+/).filter(w => w.length > 2));
            if (wordsSetForJaccard.size === 0 || prevWords.size === 0) continue;

            let intersection = 0;
            for (const w of wordsSetForJaccard) {
                if (prevWords.has(w)) intersection++;
            }
            const union = wordsSetForJaccard.size + prevWords.size - intersection;
            const overlap = intersection / union;

            if (overlap > highestOverlap) highestOverlap = overlap;
            if (overlap > 0.75) jaccardOverlaps++;
        }

        // 3. Rating & Sentiment Conflict Checks (Sentiment Mismatch)
        let isMismatch = false;
        const posMoods = ['Excellent', 'Good', '😊', '😍', '👍', 'Excellent', 'Good'];
        const negMoods = ['Disappointed', 'Terrible', '😡', '👎', '😕', 'Disappointed', 'Terrible'];
        
        const hasPosMood = posMoods.some(m => mood.includes(m));
        const hasNegMood = negMoods.some(m => mood.includes(m));

        if ((rating >= 4 && hasNegMood) || (rating <= 2 && hasPosMood)) {
            isMismatch = true;
        }

        // 4. Insufficient Data check
        const isInsufficient = text.length < 15 || words.length < 3;

        // 5. Multi-factor components
        // 5.1 Linguistic Quality (0-100)
        let linguisticQuality = 100;
        
        // Punctuation check (too many ! or ?)
        const exclamationCount = (text.match(/!/g) || []).length;
        if (exclamationCount > 3) {
            linguisticQuality -= 15;
        }

        // ALL CAPS words check
        const capsWords = words.filter(w => w === w.toUpperCase() && w.match(/[a-z]/i));
        if (words.length > 0 && capsWords.length / words.length > 0.3) {
            linguisticQuality -= 20;
        }

        // Lexical Diversity check
        const lexicalDiversity = words.length > 0 ? (uniqueWords.size / words.length) : 1;
        if (lexicalDiversity < 0.6 && words.length > 4) {
            linguisticQuality -= Math.min(30, Math.round((0.6 - lexicalDiversity) * 100));
        }

        // Excessive Marketing / Spammy keywords
        const marketingTerms = ['buy now', 'click here', 'best deal', 'discount code', 'promo', 'ref link', 'affiliate', 'guarantee', 'risk-free', 'cashback', 'winner', 'urgent'];
        let marketingMatchCount = 0;
        const textLower = text.toLowerCase();
        for (const term of marketingTerms) {
            if (textLower.includes(term)) {
                marketingMatchCount++;
                linguisticQuality -= 25;
            }
        }
        linguisticQuality = Math.min(100, Math.max(5, linguisticQuality));

        // 5.2 Specificity (0-100)
        let specificity = 40;
        
        // Check for numbers / technical metrics (e.g. 12 hours, 16gb)
        const hasNumbers = /\b\d+(?:gb|mb|mah|w|l|ml|kg|g|hours|days|%|\s?star)/i.test(text) || /\b\d+\b/.test(text);
        if (hasNumbers) {
            specificity += 25;
        }

        // Specific detail keywords (skincare, tech, general components)
        const detailKeywords = [
            'pore', 'skin', 'acne', 'hydration', 'salicylic', 'neem', 'barrier', 'oil', 'breakout', 'moisture', 'dry', 'texture', 'scent', 'absorb', 'redness',
            'battery', 'screen', 'performance', 'speed', 'cpu', 'thermal', 'ram', 'display', 'charge', 'speaker', 'noise', 'graphics', 'rtx', 'gpu',
            'taste', 'flavor', 'aroma', 'fresh', 'roasted', 'sweet', 'soft', 'fabric', 'capacity', 'suction'
        ];
        const hasDetailKeywords = detailKeywords.filter(kw => textLower.includes(kw));
        if (hasDetailKeywords.length >= 2) {
            specificity += 20;
        } else if (hasDetailKeywords.length === 1) {
            specificity += 10;
        }

        // Vague keywords penalty
        const vagueTerms = new Set(['good', 'nice', 'perfect', 'bad', 'okay', 'amazing', 'great', 'awesome']);
        const matchedVague = words.filter(w => vagueTerms.has(w));
        const hasVaguePenalty = (words.length <= 4 && matchedVague.length > 0);
        if (hasVaguePenalty) {
            specificity -= 25;
        }
        specificity = Math.min(100, Math.max(5, specificity));

        // 5.3 Uniqueness (0-100)
        let uniqueness = 100;
        if (highestOverlap > 0) {
            uniqueness -= Math.round(highestOverlap * 100);
        }
        if (jaccardOverlaps > 0) {
            uniqueness -= 20;
        }
        uniqueness = Math.min(100, Math.max(5, uniqueness));

        // 5.4 Review Depth (0-100)
        const depthScore = Math.min(100, Math.round((text.length / 5) + (words.length * 3)));

        // 5.5 Suspicious Indicators Penalty (0-100)
        let suspiciousPenalty = 0;
        if (isMismatch) suspiciousPenalty += 30;
        if (highestOverlap > 0.5) suspiciousPenalty += Math.round(highestOverlap * 50);
        if (marketingMatchCount > 0) suspiciousPenalty += 20;
        
        // Suspicious repetition pattern (consecutive identical words)
        let hasRepetitiveConsecutive = false;
        for (let i = 0; i < words.length - 1; i++) {
            if (words[i] === words[i+1] && words[i].length > 2) {
                hasRepetitiveConsecutive = true;
                break;
            }
        }
        if (hasRepetitiveConsecutive) suspiciousPenalty += 25;
        
        // 6. Calculate Final Authenticity Score with Hash-based continuous variance
        let authenticityScore = (
            (linguisticQuality * 0.25) +
            (specificity * 0.25) +
            (uniqueness * 0.30) +
            (depthScore * 0.20)
        ) - suspiciousPenalty;

        // Apply pseudo-random variation based on text characters to avoid fixed score clustering
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = text.charCodeAt(i) + ((hash << 5) - hash);
        }
        const variance = (Math.abs(hash) % 11) - 5; // value between -5 and +5
        authenticityScore += variance;
        authenticityScore = Math.min(98, Math.max(5, Math.round(authenticityScore)));

        // 7. Calculate Probabilities and Confidence
        let botScore = 15; // base probability
        let spamScore = 10;

        if (highestOverlap > 0.75) {
            botScore += 55;
            spamScore += 65;
        } else if (highestOverlap > 0.5) {
            botScore += 30;
            spamScore += 40;
        }

        if (hasVaguePenalty) {
            botScore += 15;
            spamScore += 25;
        }

        if (isMismatch) {
            botScore += 25;
            spamScore += 15;
        }

        if (hasRepetitiveConsecutive) {
            botScore += 20;
            spamScore += 30;
        }

        botScore = Math.min(95, Math.max(5, botScore));
        spamScore = Math.min(95, Math.max(5, spamScore));
        const humanScore = 100 - botScore;

        let confidenceScore = 60 + Math.min(30, Math.floor(text.length * 0.15));
        if (isInsufficient) {
            confidenceScore = 15 + words.length * 5;
        }
        if (hasVaguePenalty) {
            confidenceScore -= 20;
        }

        // 8. Verdict Selection
        let verdict = 'GENUINE';
        let explanation = 'Review matches expected organic customer patterns.';

        if (isInsufficient && highestOverlap < 0.5 && !isMismatch) {
            verdict = 'INSUFFICIENT_DATA';
            explanation = 'Review is too short to analyze reliability.';
            // For insufficient data reviews, we keep a neutral authenticity score to avoid false positive suspicious flags
            authenticityScore = Math.min(85, Math.max(70, authenticityScore));
        } else if (authenticityScore < 45) {
            verdict = 'LIKELY_FAKE';
            explanation = 'Flagged as likely artificial. Identical patterns or severe mismatches detected.';
            if (isMismatch) {
                explanation += ' Also exhibits conflicts between rating and experience mood.';
            }
        } else if (authenticityScore < 75) {
            verdict = 'SUSPICIOUS';
            explanation = 'Suspicious properties found: lacks specificity or exhibits keyword repetition.';
            if (isMismatch) {
                explanation = 'Suspicious properties found: rating conflicts with the selected experience mood.';
            }
        }

        return {
            authenticityScore,
            spamProbability: spamScore,
            botProbability: botScore,
            humanProbability: humanScore,
            reviewConfidence: Math.max(10, Math.min(98, confidenceScore)),
            verdict,
            explanation,
            breakdown: {
                copypastaDetected: jaccardOverlaps > 0,
                highestJaccard: Math.round(highestOverlap * 100),
                sentimentMismatch: isMismatch,
                vagueContent: specificity < 45,
                insufficientData: isInsufficient
            }
        };
    }
};
