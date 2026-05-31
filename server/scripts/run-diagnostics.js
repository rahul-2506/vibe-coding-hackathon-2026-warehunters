import fetch from 'node-fetch';
import { supabase } from '../db.js';

const API_URL = 'http://localhost:5000';

async function logPhase(phaseName) {
    console.log(`\n==================================================`);
    console.log(`   PHASE: ${phaseName.toUpperCase()}`);
    console.log(`==================================================`);
}

async function runDiagnostics() {
    console.log('🚀 REVIEWLENS SYSTEM DIAGNOSTIC RUNNER STARTED\n');

    // ----------------------------------------------------
    // PHASE 1 — ENVIRONMENT VALIDATION
    // ----------------------------------------------------
    await logPhase('1. Environment Validation');
    const envVars = [
        'PORT',
        'JWT_SECRET',
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY',
        'ML_SERVICE_URL'
    ];
    let envSuccess = true;
    for (const v of envVars) {
        const val = process.env[v];
        if (!val) {
            console.log(`❌ Missing Env Var: ${v}`);
            envSuccess = false;
        } else {
            console.log(`✅ Verified Env Var: ${v} = ${v === 'JWT_SECRET' || v === 'VITE_SUPABASE_ANON_KEY' ? '***' : val}`);
        }
    }
    if (envSuccess) {
        console.log('✨ Environment validation passed with zero missing variables.');
    } else {
        console.log('⚠️ Environment validation found warnings/errors.');
    }

    // ----------------------------------------------------
    // PHASE 2 — FRONTEND & API ROUTE AUDIT
    // ----------------------------------------------------
    await logPhase('2. API Diagnostics & Response Schema Auditing');
    
    const endpoints = [
        { name: 'Products Catalog', url: `${API_URL}/api/products`, method: 'GET' },
        { name: 'Product Details (ID 1)', url: `${API_URL}/api/products/1`, method: 'GET' },
        { name: 'Product Reviews (ID 1)', url: `${API_URL}/api/products/1/reviews`, method: 'GET' },
        { name: 'Public Feedbacks Feed', url: `${API_URL}/api/feedbacks`, method: 'GET' },
        { name: 'Search Products', url: `${API_URL}/api/search?q=neem`, method: 'GET' }
    ];

    for (const ep of endpoints) {
        const start = Date.now();
        try {
            const res = await fetch(ep.url, { method: ep.method });
            const elapsed = Date.now() - start;
            console.log(`\n📡 Auditing Endpoint: [${ep.method}] ${ep.url}`);
            console.log(`   - HTTP Status: ${res.status}`);
            console.log(`   - Response Time: ${elapsed}ms`);
            if (res.ok) {
                const json = await res.json();
                console.log(`   - Schema Check: ${json.success ? '✅ Enveloped (success=true)' : '⚠️ Unexpected/Flat Schema'}`);
                if (json.data) {
                    const sample = Array.isArray(json.data) ? json.data[0] : json.data;
                    console.log(`   - Sample Data Keys: ${sample ? Object.keys(sample).slice(0, 5).join(', ') : 'None'}`);
                }
            } else {
                const text = await res.text();
                console.log(`   ❌ Failed with response: ${text.substring(0, 100)}`);
            }
        } catch (err) {
            console.log(`   ❌ Request failed: ${err.message}`);
        }
    }

    // ----------------------------------------------------
    // PHASE 3 — DATABASE SCHEMAS & RLS AUDIT
    // ----------------------------------------------------
    await logPhase('3. Database Connectivity & Table Audit');
    const tables = ['profiles', 'products', 'reviews', 'feedbacks', 'watchlists', 'comparison_history', 'product_scientific_verifiers'];
    
    for (const t of tables) {
        try {
            const { data, error } = await supabase.from(t).select('*').limit(1);
            if (error) {
                console.log(`❌ Table [${t}]: Query Failed. Error: [${error.code}] ${error.message}`);
            } else {
                console.log(`✅ Table [${t}]: Active and Accessible (Found ${data ? data.length : 0} rows cached/returned)`);
            }
        } catch (err) {
            console.log(`❌ Table [${t}]: Fatal JS Exception: ${err.message}`);
        }
    }

    // ----------------------------------------------------
    // PHASE 4 — CHATBOT RAG ENGINE & FALLBACK PROBE
    // ----------------------------------------------------
    await logPhase('4. Chatbot RAG Synthesis Audit');
    
    const chatPayload = { message: 'Is Neem good for acne breakout?' };
    console.log(`💬 Posting Chat Request: "${chatPayload.message}"`);
    const startChat = Date.now();
    
    try {
        // Since chat route requires authentication, let's trace local Fallback RAG directly or try hitting route.
        // Let's import local RAG service to check it directly, bypassing auth headers constraint if needed,
        // or let's see what happens if we query without token:
        const res = await fetch(`${API_URL}/api/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chatPayload)
        });
        const elapsed = Date.now() - startChat;
        console.log(`   - Status without Auth Token: ${res.status} (Expected 401: Access Denied)`);
        
        // Let's test the local RAG engine function directly!
        console.log(`🧪 Testing Local Node.js RAG Synthesis directly...`);
        const { queryRAG } = await import('../services/ragService.js');
        const ragRes = await queryRAG(chatPayload.message);
        console.log(`   - Local RAG Response Status: ✅ ACTIVE`);
        console.log(`   - Synthesized Output excerpt:\n     "${ragRes.substring(0, 200)}..."`);
    } catch (err) {
        console.log(`   ❌ RAG Engine Direct Test Failed: ${err.message}`);
    }

    console.log('\n==================================================');
    console.log('🏁 SYSTEM DIAGNOSTIC RUNNER COMPLETE');
    console.log('==================================================\n');
}

runDiagnostics().catch(err => {
    console.error('Fatal runner error:', err);
});
