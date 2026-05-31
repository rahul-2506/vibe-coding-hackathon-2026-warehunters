import { feedbackService } from '../services/feedbackService.js';
import { supabase } from '../db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function runTests() {
    console.log('==================================================');
    console.log('    PHASE 5 INTEGRATION & VERIFICATION SUITE      ');
    console.log('==================================================\n');

    let authenticatedUserId = null;
    try {
        const testEmail = `tester_${Math.floor(Math.random() * 1000000)}@example.com`;
        const testPassword = 'SecurePassword123!';
        
        console.log(`🔑 Creating temporary authenticated user session (${testEmail})...`);
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: testEmail,
            password: testPassword
        });

        if (authError) {
            console.warn('⚠️ Signup failed (email confirmation may be enabled):', authError.message);
        } else if (authData && authData.user) {
            authenticatedUserId = authData.user.id;
            console.log('✅ Authenticated user created. UUID:', authenticatedUserId);
            
            // Set session explicitly
            if (authData.session) {
                await supabase.auth.setSession(authData.session);
            }
        }
    } catch (authErr) {
        console.warn('⚠️ Authentication setup error:', authErr.message);
    }

    const testProduct = 'The Derma Co 2% Salicylic Acid Cleanser';

    // Ensure mock product exists in the Supabase database
    try {
        console.log(`🔍 Checking if product "${testProduct}" exists in Supabase products table...`);
        const { data: prods, error: prodErr } = await supabase
            .from('products')
            .select('id')
            .eq('title', testProduct)
            .limit(1);
        
        if (prodErr) {
            throw prodErr;
        }

        if (!prods || prods.length === 0) {
            console.log(`➕ Product not found. Inserting mock product "${testProduct}"...`);
            const { data: insData, error: insErr } = await supabase
                .from('products')
                .insert({
                    title: testProduct,
                    name: testProduct,
                    price: 299.00,
                    category: 'Skincare',
                    description: 'Dermatologically formulated Salicylic Acid cleanser for oily and acne-prone skin.',
                    explanation: 'Deep keratolytic sebum control agent.'
                })
                .select('id');
            
            if (insErr) {
                console.error('❌ Failed to insert mock product:', insErr.message);
            } else {
                console.log(`✅ Mock product inserted! Assigned ID:`, insData[0]?.id);
            }
        } else {
            console.log(`✅ Product already exists! ID:`, prods[0]?.id);
        }
    } catch (err) {
        console.warn('⚠️ Product validation warning:', err.message);
    }

    // ----------------------------------------------------
    // CASE 1: Detailed Clinical Review (Should be GENUINE)
    // ----------------------------------------------------
    console.log('\n--- TEST CASE 1: Detailed Clinical Review ---');
    try {
        const payload1 = {
            product_name: testProduct,
            rating: 5,
            review_text: 'I have oily and acne-prone skin. This Salicylic Acid cleanser really helped clear up my pores and reduced breakouts significantly over two weeks of daily use. Highly recommended!',
            emoji: '😀',
            source: 'dermatologist',
            mentioned_ingredients: ['salicylic acid'],
            experience_mood: '😀 Excellent',
            highlight_categories: ['Results', 'Ingredients'],
            recommendation: '👍 Yes',
            discovery_source: 'Dermatologist Recommendation',
            confidence_score: 95,
            user_id: authenticatedUserId
        };
        const result1 = await feedbackService.submitFeedback(payload1);
        console.log('Verdict:', result1.classification);
        console.log('Trust Score:', result1.trust_score);
        console.log('Reviewer Score:', result1.reviewer_score);
        console.log('Breakdown:', JSON.stringify(result1.analysis_breakdown));
        console.log('ML Explanation:', result1.ml_explanation);
        if (result1.classification === 'GENUINE' && result1.trust_score >= 80) {
            console.log('✅ TEST CASE 1 PASSED!\n');
        } else {
            console.log('❌ TEST CASE 1 FAILED!\n');
        }
    } catch (err) {
        console.error('❌ TEST CASE 1 EXCEPTION:', err.message, '\n');
    }

    // ----------------------------------------------------
    // CASE 2: Contradictory Review (Should be SUSPICIOUS -15)
    // ----------------------------------------------------
    console.log('--- TEST CASE 2: Contradictory Review (Sentiment Mismatch) ---');
    try {
        const payload2 = {
            product_name: testProduct,
            rating: 1,
            review_text: 'This is absolutely a terrible product. It caused extreme redness, skin barrier irritation, and severe dry skin. Do not buy!',
            emoji: '😡',
            source: 'self',
            mentioned_ingredients: [],
            experience_mood: '😀 Excellent', // Intentionally mismatched mood
            highlight_categories: ['Ingredients'],
            recommendation: '👎 No',
            discovery_source: 'Social Media',
            confidence_score: 80,
            user_id: authenticatedUserId
        };
        const result2 = await feedbackService.submitFeedback(payload2);
        console.log('Verdict:', result2.classification);
        console.log('Trust Score:', result2.trust_score);
        console.log('Breakdown:', JSON.stringify(result2.analysis_breakdown));
        console.log('ML Explanation:', result2.ml_explanation);
        // Should trigger SUSPICIOUS and suffer penalty
        if (result2.classification === 'SUSPICIOUS' && result2.ml_explanation.includes('conflicts')) {
            console.log('✅ TEST CASE 2 PASSED!\n');
        } else {
            console.log('❌ TEST CASE 2 FAILED!\n');
        }
    } catch (err) {
        console.error('❌ TEST CASE 2 EXCEPTION:', err.message, '\n');
    }

    // ----------------------------------------------------
    // CASE 3: Copypasta Review (Should be LIKELY_FAKE -40)
    // ----------------------------------------------------
    console.log('--- TEST CASE 3: Copypasta / Duplication Check ---');
    try {
        const copypastaText = `This is a fantastic product! Best face wash ever, completely changed my routine and made my face shine. Perfect! ${Math.random()}`;
        const payload3a = {
            product_name: testProduct,
            rating: 5,
            review_text: copypastaText,
            emoji: '👍',
            source: 'self',
            mentioned_ingredients: [],
            experience_mood: '🙂 Good',
            highlight_categories: ['Results'],
            recommendation: '👍 Yes',
            discovery_source: 'Own Research',
            confidence_score: 90,
            user_id: authenticatedUserId
        };
        // Submit first
        console.log('Submitting review once...');
        const result3a = await feedbackService.submitFeedback(payload3a);
        console.log('First Submit - Verdict:', result3a.classification, 'Trust:', result3a.trust_score);

        // Submit exact same text again
        console.log('Submitting identical review text again...');
        const result3b = await feedbackService.submitFeedback(payload3a);
        console.log('Verdict:', result3b.classification);
        console.log('Trust Score:', result3b.trust_score);
        console.log('ML Explanation:', result3b.ml_explanation);
        if (result3b.classification === 'LIKELY_FAKE' && result3b.trust_score <= 45) {
            console.log('✅ TEST CASE 3 PASSED!\n');
        } else {
            console.log('❌ TEST CASE 3 FAILED!\n');
        }
    } catch (err) {
        console.error('❌ TEST CASE 3 EXCEPTION:', err.message, '\n');
    }

    // ----------------------------------------------------
    // CASE 4: Image Context Bonus (+5 trust)
    // ----------------------------------------------------
    console.log('--- TEST CASE 4: Image Context Bonus ---');
    try {
        const payload4a = {
            product_name: testProduct,
            rating: 4,
            review_text: 'The salicylic acid cleanser works well for oily skin and acne pores.',
            emoji: '🙂',
            source: 'self',
            mentioned_ingredients: ['salicylic acid'],
            experience_mood: '🙂 Good',
            highlight_categories: ['Results'],
            recommendation: '👍 Yes',
            discovery_source: 'Own Research',
            confidence_score: 85,
            image_url: '', // No image
            user_id: authenticatedUserId
        };
        const result4a = await feedbackService.submitFeedback(payload4a);
        console.log('Without Image - Trust Score:', result4a.trust_score);

        const payload4b = {
            ...payload4a,
            image_url: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc' // With image
        };
        const result4b = await feedbackService.submitFeedback(payload4b);
        console.log('With Image - Trust Score:', result4b.trust_score);
        
        if (result4b.trust_score === result4a.trust_score + 5) {
            console.log('✅ TEST CASE 4 PASSED! (+5 Image-text context bonus applied)\n');
        } else {
            console.log('❌ TEST CASE 4 FAILED!\n');
        }
    } catch (err) {
        console.error('❌ TEST CASE 4 EXCEPTION:', err.message, '\n');
    }

    console.log('==================================================');
    console.log('🏁 INTEGRATION & VERIFICATION SUITE RUN FINISHED');
    console.log('==================================================\n');
}

runTests();
