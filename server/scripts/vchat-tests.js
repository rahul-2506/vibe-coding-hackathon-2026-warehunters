/**
 * VChat Agent Integration Test Suite
 * Programmatically runs and validates all core agent capabilities:
 *   1. Guided Skincare Discovery state machine
 *   2. Session Memory updates & retention
 *   3. Product Search and targeted clinical recommendation quality
 *   4. Conversational refinement search logic (contextual filters)
 *   5. Scientific ingredient profile lookups
 *   6. Real-time review trust fraud analysis (sentiment mismatch & copypastas)
 *   7. Dynamic inventory routines builder with clinical explanations
 *   8. Multi-dimension comparative analytics
 */

import db from '../db.js';
import { vchatOrchestrate } from '../services/vchat/agent.js';
import { sessionMemory } from '../services/vchat/sessionMemory.js';
import assert from 'assert';

async function runTests() {
    console.log('================================================================');
    console.log('         🔬 VCHAT AGENT COMPLETE INTEGRATION TEST SUITE          ');
    console.log('================================================================\n');

    try {
        console.log('📡 [1/10] Connecting to Supabase database catalog...');
        await db.initialize();
        console.log('✅ Database connectivity verified.\n');

        const userId = `tester_agent_${Date.now()}`;
        console.log(`👤 Assigned Test User UUID: ${userId}`);

        // ─────────────── TEST 1: GUIDED DISCOVERY FLOW INITIALIZATION ───────────────
        console.log('\n----------------------------------------------------------------');
        console.log('TEST 1: Guided Skincare Discovery Flow Initialization');
        console.log('----------------------------------------------------------------');
        
        let res = await vchatOrchestrate({ message: 'Start Skincare Discovery Flow', userId });
        
        assert.strictEqual(res.type, 'guided_discovery', 'Response type should be guided_discovery');
        assert.ok(res.response.includes('Step 2/5'), 'Response text should prompt next question');
        
        let session = sessionMemory.get(userId);
        assert.strictEqual(session.discoveryStep, 2, 'Should advance to step 2');
        console.log('✅ TEST 1 PASSED: Guided Discovery initialized and advanced.');

        // ─────────────── TEST 2: GUIDED DISCOVERY PROGRESSION ───────────────
        console.log('\n----------------------------------------------------------------');
        console.log('TEST 2: Guided Skincare Discovery Progression (Acne Concern)');
        console.log('----------------------------------------------------------------');
        
        // Step 2 Answer concern
        res = await vchatOrchestrate({ message: 'acne and breakouts', userId });
        assert.strictEqual(res.type, 'guided_discovery', 'Response type should be guided_discovery');
        assert.ok(res.response.includes('Step 3/5'), 'Response should prompt for budget');
        
        session = sessionMemory.get(userId);
        assert.ok(session.concerns.includes('acne'), 'Should store acne concern');
        assert.strictEqual(session.discoveryStep, 3, 'Should advance to step 3');

        // Step 3 Answer budget
        res = await vchatOrchestrate({ message: 'under $30', userId });
        assert.strictEqual(res.type, 'guided_discovery', 'Response type should be guided_discovery');
        assert.ok(res.response.includes('Step 4/5'), 'Response should prompt for experience');
        
        session = sessionMemory.get(userId);
        assert.strictEqual(session.budget, 30, 'Should store budget limit of $30');
        assert.strictEqual(session.discoveryStep, 4, 'Should advance to step 4');

        // Step 4 Answer experience
        res = await vchatOrchestrate({ message: 'I am a beginner', userId });
        assert.strictEqual(res.type, 'guided_discovery', 'Response type should be guided_discovery');
        assert.ok(res.response.includes('Step 5/5'), 'Response should prompt for sensitivities');
        
        session = sessionMemory.get(userId);
        assert.strictEqual(session.experience, 'beginner', 'Should store experience level');
        assert.strictEqual(session.discoveryStep, 5, 'Should advance to step 5');

        // Step 5 Answer sensitivities (completing discovery!)
        res = await vchatOrchestrate({ message: 'Sensitive to fragrance', userId });
        assert.strictEqual(res.type, 'discovery_completed', 'Response type should be discovery_completed');
        assert.ok(res.response.includes('skincare profile'), 'Response should summarize profile');
        
        session = sessionMemory.get(userId);
        assert.strictEqual(session.discoveryStep, null, 'Discovery step should be reset to null');
        assert.strictEqual(session.sensitivities, 'fragrance', 'Should store sensitivities');
        console.log('✅ TEST 2 PASSED: Full Discovery state machine successfully traversed.');

        // ─────────────── TEST 3: RECOMMENDATION QUALITY & MEMORY RETENTION ───────────────
        console.log('\n----------------------------------------------------------------');
        console.log('TEST 3: Skincare Recommendations & Session Memory Retention');
        console.log('----------------------------------------------------------------');
        
        // Force skinType = 'oily' to verify memory combination
        sessionMemory.update(userId, { skinType: 'oily' });

        res = await vchatOrchestrate({ message: 'Recommend me a moisturizer', userId });
        
        assert.strictEqual(res.type, 'product_list', 'Response type should be product_list');
        assert.ok(res.data.products.length > 0, 'Should return matching products');
        
        const firstProd = res.data.products[0];
        assert.ok(firstProd.whyRecommend, 'Product should have whyRecommend explanation object');
        assert.ok(firstProd.whyRecommend.skinTypeMatch.includes('oily'), 'Should contextualize match for oily skin');
        assert.ok(firstProd.whyRecommend.concernMatch.includes('acne'), 'Should contextualize match for acne concern');
        console.log('✅ TEST 3 PASSED: Session memory active and whyRecommend matches profile.');

        // ─────────────── TEST 4: CONVERSATIONAL SEARCH REFINEMENTS ───────────────
        console.log('\n----------------------------------------------------------------');
        console.log('TEST 4: Conversational Search Refinement Filters (Phase 6)');
        console.log('----------------------------------------------------------------');
        
        // User clicks chip or types follow-up refinement "Fragrance Free"
        res = await vchatOrchestrate({ message: 'Fragrance Free', userId });
        
        assert.strictEqual(res.type, 'product_list', 'Should return product list');
        assert.ok(res.data.products.length > 0, 'Should return refined product listings');
        console.log('✅ TEST 4 PASSED: Refined query search contextualized successfully.');

        // ─────────────── TEST 5: MULTI-DIMENSION COMPARISONS ───────────────
        console.log('\n----------------------------------------------------------------');
        console.log('TEST 5: Side-by-Side Product Comparison Dimensions (Phase 7)');
        console.log('----------------------------------------------------------------');
        
        res = await vchatOrchestrate({ message: 'Compare Luminis vs DermaGlow', userId });
        
        assert.strictEqual(res.type, 'comparison', 'Response type should be comparison');
        assert.ok(res.data.productA, 'Should map product A');
        assert.ok(res.data.productB, 'Should map product B');
        assert.ok(res.data.winners, 'Should compute dimension winners');
        assert.ok(res.data.winners.ingredient, 'Should have ingredient winner');
        assert.ok(res.data.winners.value, 'Should have value winner');
        assert.ok(res.data.winners.review, 'Should have review trust winner');
        assert.ok(res.data.winners.overall, 'Should have overall winner');
        assert.ok(res.data.reasoning, 'Should have clinical comparative reasoning');
        console.log('✅ TEST 5 PASSED: Side-by-side comparative scoring matches requirement.');

        // ─────────────── TEST 6: REVIEW TRUST FRAUD ANALYSIS ───────────────
        console.log('\n----------------------------------------------------------------');
        console.log('TEST 6: Verified Review Trust & Fraud Analysis (Phase 8)');
        console.log('----------------------------------------------------------------');
        
        res = await vchatOrchestrate({ message: 'Can I trust Luminis Hydrating Serum?', userId });
        
        assert.strictEqual(res.type, 'trust_analysis', 'Response type should be trust_analysis');
        assert.ok(res.data.avgTrustScore !== undefined, 'Should calculate average trust');
        assert.ok(res.data.suspiciousPercentage !== undefined, 'Should calculate suspicious review rate');
        assert.ok(res.data.duplicateCount !== undefined, 'Should perform duplicate text scan');
        assert.ok(res.data.sentimentMismatchCount !== undefined, 'Should perform sentiment contradiction scan');
        assert.ok(res.data.recommendation, 'Should provide clinical recommendations');
        console.log('✅ TEST 6 PASSED: Trust fraud scan executed successfully.');

        // ─────────────── TEST 7: DYNAMIC SKINCARE ROUTINE BUILDER ───────────────
        console.log('\n----------------------------------------------------------------');
        console.log('TEST 7: Dynamic Skincare Routine Builder (Phase 9)');
        console.log('----------------------------------------------------------------');
        
        res = await vchatOrchestrate({ message: 'Build me a skincare routine', userId });
        
        assert.strictEqual(res.type, 'routine', 'Response type should be routine');
        assert.ok(res.data.morningRoutine.length > 0, 'Morning routine should be populated');
        assert.ok(res.data.eveningRoutine.length > 0, 'Evening routine should be populated');
        
        const morningCleanser = res.data.morningRoutine[0];
        assert.ok(morningCleanser.product.explanation, 'Step product should have custom clinical explanation');
        console.log('✅ TEST 7 PASSED: Routines generated with personalized clinical explanations.');

        // ─────────────── TEST 8: INGREDIENT SCIENTIFIC QUERIES ───────────────
        console.log('\n----------------------------------------------------------------');
        console.log('TEST 8: Scientific Ingredient Clinical Profile');
        console.log('----------------------------------------------------------------');
        
        res = await vchatOrchestrate({ message: 'Explain niacinamide', userId });
        
        assert.strictEqual(res.type, 'ingredient_info', 'Response type should be ingredient_info');
        assert.ok(res.data.fullName, 'Should fetch active ingredient full name');
        assert.ok(res.data.benefits.length > 0, 'Should fetch benefits');
        assert.ok(res.data.suitability.length > 0, 'Should fetch suitability');
        assert.ok(res.data.combos, 'Should fetch clinical combination notes');
        console.log('✅ TEST 8 PASSED: Scientific active ingredient query completed.');

        console.log('\n================================================================');
        console.log('🎉 🎉 🎉   ALL VCHAT INTEGRATION TESTS PASSED SUCCESSFULLY!    🎉 🎉 🎉');
        console.log('================================================================\n');

        // Cleanup test session memory
        sessionMemory.reset(userId);

    } catch (err) {
        console.error('\n❌ INTEGRATION TESTS FAILED with exception:');
        console.error(err);
        process.exit(1);
    }
}

runTests();
