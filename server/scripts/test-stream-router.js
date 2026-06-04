/**
 * Modular Agent Stream Router Test Suite
 * Programmatically runs the streamRouter through all main shopping assistant stages:
 *   1. Recalls memory & intent detection
 *   2. Plan mapping & tool selection
 *   3. RAG hybrid search & reasoning compilation
 *   4. Output synthesis & reflection audit
 *   5. Token streaming simulation
 */

import db from '../db.js';
import { streamRouter } from '../src/chat/streamRouter.js';
import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testScenario(message, userId) {
    console.log(`\n💬 Testing Message: "${message}"`);
    console.log(`👤 User: ${userId}`);
    console.log('--------------------------------------------------');

    const thoughts = [];
    const textChunks = [];
    let done = false;

    const mockRes = {
        write(chunk) {
            if (chunk.startsWith('data: ')) {
                try {
                    const dataStr = chunk.slice(6).trim();
                    if (dataStr === '[DONE]') return;
                    const parsed = JSON.parse(dataStr);
                    if (parsed.status) {
                        thoughts.push(parsed.status);
                        console.log(`   [THOUGHT STAGE]: ${parsed.status}`);
                    }
                    if (parsed.text) {
                        textChunks.push(parsed.text);
                        process.stdout.write(parsed.text);
                    }
                } catch (e) {
                    console.error('Failed to parse chunk:', chunk);
                }
            } else if (chunk.startsWith('event: end')) {
                done = true;
            }
        },
        end() {
            done = true;
        }
    };

    const abortController = new AbortController();

    await streamRouter.stream(
        message,
        {},
        userId,
        mockRes,
        abortController.signal,
        {}
    );

    console.log('\n--------------------------------------------------');
    console.log(`✅ Completed scenario.`);
    console.log(`   Captured ${thoughts.length} thought stages.`);
    console.log(`   Captured ${textChunks.length} text chunks.`);
    
    assert.ok(thoughts.length > 0, 'Should execute at least one thought stage');
    assert.ok(textChunks.length > 0, 'Should stream text response chunks');
}

async function run() {
    console.log('================================================================');
    console.log('       🔬 MODULAR AGENT PIPELINE DIAGNOSTIC VERIFIER            ');
    console.log('================================================================\n');

    try {
        console.log('📡 Connecting to database catalog...');
        await db.initialize();
        console.log('✅ Database connected.\n');

        const userId = `tester_stream_${Date.now()}`;

        // Scenario 1: Product recommendation request (uses productSearch tool / hybrid RAG)
        await testScenario('Recommend me a good moisturizer for acne breakouts under $30', userId);

        // Scenario 2: Product comparison request (uses comparison tool)
        await testScenario('Compare Luminis Hydrating Serum with DermaGlow Clarifying Gel', userId);

        // Scenario 3: Scientific active ingredient query (uses ingredientAnalyzer tool)
        await testScenario('What are the benefits of niacinamide?', userId);

        console.log('\n================================================================');
        console.log('🎉 🎉 🎉   ALL MODULAR STREAM ROUTER TESTS PASSED!             🎉 🎉 🎉');
        console.log('================================================================\n');

    } catch (err) {
        console.error('\n❌ TEST RUNNER EXCEPTION:');
        console.error(err);
        process.exit(1);
    }
}

run();
