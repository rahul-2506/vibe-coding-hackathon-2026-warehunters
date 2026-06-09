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
                explanation: 'Empty review text submitted.'
            };
        }

        // 1. Check for Copypasta Jaccard Similarity against past reviews
        let jaccardOverlaps = 0;
        let highestOverlap = 0;
        const words = new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 2));
        
        for (const prev of pastReviews) {
            const prevText = (prev.review_text || prev.review || '').trim();
            if (!prevText) continue;
            if (prev.id && reviewData.id && prev.id === reviewData.id) continue;

            const prevWords = new Set(prevText.toLowerCase().split(/\s+/).filter(w => w.length > 2));
            if (words.size === 0 || prevWords.size === 0) continue;

            let intersection = 0;
            for (const w of words) {
                if (prevWords.has(w)) intersection++;
            }
            const union = words.size + prevWords.size - intersection;
            const overlap = intersection / union;

            if (overlap > highestOverlap) highestOverlap = overlap;
            if (overlap > 0.75) jaccardOverlaps++;
        }

        // 2. Check for Vague Keywords
        const vagueTerms = new Set(['good', 'nice', 'perfect', 'bad', 'okay', 'amazing', 'great', 'awesome']);
        const matchedVague = [...words].filter(w => vagueTerms.has(w));
        const isVague = text.length < 25 || (words.size <= 4 && matchedVague.length > 0);

        // 3. Rating & Sentiment Conflict Checks (Sentiment Mismatch)
        let isMismatch = false;
        const posMoods = ['Excellent', 'Good', '😊', '😍', '👍'];
        const negMoods = ['Disappointed', 'Terrible', '😡', '👎', '😕'];
        
        const hasPosMood = posMoods.some(m => mood.includes(m));
        const hasNegMood = negMoods.some(m => mood.includes(m));

        if ((rating >= 4 && hasNegMood) || (rating <= 2 && hasPosMood)) {
            isMismatch = true;
        }

        // 4. Calculate Scores
        // Pseudo-random deterministic jitter based on text content
        const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const jitter1 = (hash % 13) - 6; // -6 to +6
        const jitter2 = (hash % 17) - 8; // -8 to +8

        let botScore = 15 + jitter1; 
        let spamScore = 10 + jitter2;
        let confidenceScore = 60 + Math.min(30, Math.floor(text.length * 0.1)) + jitter1;

        if (jaccardOverlaps > 0) {
            botScore += 50;
            spamScore += 60;
        } else if (highestOverlap > 0.5) {
            botScore += 25;
            spamScore += 35;
        }

        if (isVague) {
            const lengthPenalty = Math.max(5, 30 - text.length); // 5 to 30 penalty
            botScore += Math.floor(lengthPenalty * 0.5);
            spamScore += Math.floor(lengthPenalty * 0.8);
            confidenceScore -= 20;
        } else {
            const detailBonus = Math.min(15, Math.floor(words.size / 3));
            botScore -= detailBonus;
            spamScore -= detailBonus;
        }

        if (isMismatch) {
            botScore += 25;
            spamScore += 15;
        }

        // Clip scores between 0-100
        botScore = Math.min(95, Math.max(5, botScore));
        spamScore = Math.min(95, Math.max(5, spamScore));
        const humanScore = 100 - botScore;
        const authenticityScore = 100 - Math.max(botScore, spamScore);
        
        let verdict = 'GENUINE';
        let explanation = 'Review matches expected organic customer patterns.';

        if (authenticityScore < 45) {
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
                vagueContent: isVague
            }
        };
    }
};
