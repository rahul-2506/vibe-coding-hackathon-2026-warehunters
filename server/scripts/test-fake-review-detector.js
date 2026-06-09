import { fakeReviewDetector } from '../services/gateway/fakeReviewDetector.js';

function runTests() {
    console.log("==================================================================");
    console.log("🧪 RUNNING FAKE REVIEW DETECTOR UNIT TESTS");
    console.log("==================================================================");

    // Test Case 1: "Good" (Very short)
    const res1 = fakeReviewDetector.detectFakeReview({
        review_text: "Good",
        rating: 5,
        experience_mood: "🙂 Good"
    });
    console.log("\n[Test 1] Review: \"Good\"");
    console.log(`  Verdict: ${res1.verdict} (Expected: INSUFFICIENT_DATA)`);
    console.log(`  Authenticity Score: ${res1.authenticityScore}%`);
    console.log(`  Confidence: ${res1.reviewConfidence}%`);
    if (res1.verdict !== 'INSUFFICIENT_DATA') throw new Error("Test 1 Failed: Should be INSUFFICIENT_DATA");

    // Test Case 2: "Good product" (Short)
    const res2 = fakeReviewDetector.detectFakeReview({
        review_text: "Good product",
        rating: 4,
        experience_mood: "🙂 Good"
    });
    console.log("\n[Test 2] Review: \"Good product\"");
    console.log(`  Verdict: ${res2.verdict} (Expected: INSUFFICIENT_DATA)`);
    console.log(`  Authenticity Score: ${res2.authenticityScore}%`);
    console.log(`  Confidence: ${res2.reviewConfidence}%`);
    if (res2.verdict !== 'INSUFFICIENT_DATA') throw new Error("Test 2 Failed: Should be INSUFFICIENT_DATA");

    // Test Case 3: Detailed genuine review
    const res3 = fakeReviewDetector.detectFakeReview({
        review_text: "This laptop has excellent battery life and lasted 12 hours during testing",
        rating: 5,
        experience_mood: "😀 Excellent"
    });
    console.log("\n[Test 3] Review: \"This laptop has excellent battery life and lasted 12 hours during testing\"");
    console.log(`  Verdict: ${res3.verdict} (Expected: GENUINE)`);
    console.log(`  Authenticity Score: ${res3.authenticityScore}%`);
    console.log(`  Confidence: ${res3.reviewConfidence}%`);
    if (res3.verdict !== 'GENUINE') throw new Error("Test 3 Failed: Should be GENUINE");
    if (res3.authenticityScore < 75) throw new Error("Test 3 Failed: Authenticity score should be high");

    // Test Case 4: Repeated spam reviews
    const pastReviews = [
        { id: 1, review_text: "Wow super cheap deal buy now risk-free cashback winner click here!", rating: 5 },
        { id: 2, review_text: "Wow super cheap deal buy now risk-free cashback winner click here!", rating: 5 }
    ];
    const res4 = fakeReviewDetector.detectFakeReview({
        review_text: "Wow super cheap deal buy now risk-free cashback winner click here!",
        rating: 5,
        experience_mood: "😊 😍 👍"
    }, pastReviews);
    console.log("\n[Test 4] Review: Repeated spam/copypasta review");
    console.log(`  Verdict: ${res4.verdict} (Expected: LIKELY_FAKE)`);
    console.log(`  Authenticity Score: ${res4.authenticityScore}%`);
    console.log(`  Confidence: ${res4.reviewConfidence}%`);
    if (res4.verdict !== 'LIKELY_FAKE') throw new Error("Test 4 Failed: Should be LIKELY_FAKE");

    // Test Case 5: AI-generated style promotional review
    const res5 = fakeReviewDetector.detectFakeReview({
        review_text: "OMG this is the best product ever!!! Buy now risk-free guarantee cashback winner!!! Super amazing deal!",
        rating: 5,
        experience_mood: "😊 😍 👍"
    });
    console.log("\n[Test 5] Review: AI-generated style review (Over-promotional)");
    console.log(`  Verdict: ${res5.verdict} (Expected: SUSPICIOUS or LIKELY_FAKE)`);
    console.log(`  Authenticity Score: ${res5.authenticityScore}%`);
    console.log(`  Confidence: ${res5.reviewConfidence}%`);
    if (res5.verdict !== 'SUSPICIOUS' && res5.verdict !== 'LIKELY_FAKE') {
        throw new Error("Test 5 Failed: Should be SUSPICIOUS or LIKELY_FAKE");
    }

    // Assert significantly different scores
    console.log("\n------------------------------------------------------------------");
    console.log("📊 SCORE INTEGRITY CHECKS");
    console.log(`  Good: ${res1.authenticityScore}%`);
    console.log(`  Genuine: ${res3.authenticityScore}%`);
    console.log(`  Spam: ${res4.authenticityScore}%`);
    console.log(`  AI-promo: ${res5.authenticityScore}%`);
    
    const diffGenuineSpam = Math.abs(res3.authenticityScore - res4.authenticityScore);
    const diffGenuineAI = Math.abs(res3.authenticityScore - res5.authenticityScore);
    console.log(`  Genuine vs Spam Score Difference: ${diffGenuineSpam}%`);
    console.log(`  Genuine vs AI-promo Score Difference: ${diffGenuineAI}%`);

    if (diffGenuineSpam < 20) throw new Error("Score difference between genuine and spam is too low!");
    if (diffGenuineAI < 15) throw new Error("Score difference between genuine and AI-promo is too low!");

    console.log("\n==================================================================");
    console.log("✅ ALL FAKE REVIEW DETECTOR TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================================");
}

try {
    runTests();
} catch (error) {
    console.error("❌ TEST RUN FAILED:", error.message);
    process.exit(1);
}
