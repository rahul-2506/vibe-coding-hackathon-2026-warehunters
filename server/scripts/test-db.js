import { supabase } from '../db.js';
import { logger } from '../utils/logger.js';

async function runAudit() {
    console.log('==================================================');
    console.log('     SUPABASE DATABASE INTEGRITY & QUERY AUDIT     ');
    console.log('==================================================\n');

    const tables = [
        { name: 'profiles', query: supabase.from('profiles').select('*').limit(1) },
        { name: 'products', query: supabase.from('products').select('*').limit(1) },
        { name: 'reviews', query: supabase.from('reviews').select('*').limit(1) },
        { name: 'feedbacks', query: supabase.from('feedbacks').select('*').limit(1) },
        { name: 'feedback (alternative)', query: supabase.from('feedback').select('*').limit(1) },
        { name: 'watchlists', query: supabase.from('watchlists').select('*').limit(1) },
        { name: 'comparison_history', query: supabase.from('comparison_history').select('*').limit(1) },
        { name: 'comparison_scores', query: supabase.from('comparison_scores').select('*').limit(1) },
        { name: 'saved_comparisons', query: supabase.from('saved_comparisons').select('*').limit(1) },
        { name: 'product_scientific_verifiers', query: supabase.from('product_scientific_verifiers').select('*').limit(1) }
    ];

    const results = [];

    for (const table of tables) {
        try {
            const { data, error } = await table.query;
            if (error) {
                // If it is a 42P01 error, the table does not exist
                const exists = error.code !== '42P01';
                results.push({
                    name: table.name,
                    status: 'FAIL',
                    exists: exists,
                    error: error.message,
                    code: error.code,
                    columns: null
                });
            } else {
                const sample = data && data[0] ? data[0] : null;
                const columns = sample ? Object.keys(sample) : [];
                results.push({
                    name: table.name,
                    status: 'PASS',
                    exists: true,
                    error: null,
                    code: null,
                    columns: columns
                });
            }
        } catch (err) {
            results.push({
                name: table.name,
                status: 'FAIL',
                exists: false,
                error: err.message,
                code: 'JS_EXCEPTION',
                columns: null
            });
        }
    }

    console.log('--------------------------------------------------');
    console.log('                DIAGNOSTIC RESULTS                ');
    console.log('--------------------------------------------------');
    for (const res of results) {
        const icon = res.status === 'PASS' ? '✅' : '❌';
        console.log(`${icon} Table [${res.name}]: ${res.status}`);
        if (res.status === 'FAIL') {
            console.log(`   - Exists in Schema: ${res.exists ? 'YES' : 'NO'}`);
            console.log(`   - Error: [${res.code}] ${res.error}`);
        } else {
            console.log(`   - Verified Columns: ${res.columns.length > 0 ? res.columns.join(', ') : '(Empty Table - No columns mapped)'}`);
        }
        console.log('');
    }
    console.log('==================================================');
}

runAudit().catch(err => {
    console.error('Fatal audit failure:', err);
});
