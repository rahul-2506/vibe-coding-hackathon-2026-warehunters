import { supabase } from '../db.js';

async function checkLegacyColumns() {
    console.log('Testing legacy columns on "reviews" table...');
    const columns = [
        'id',
        'product_id',
        'rating',
        'review_text',
        'emoji',
        'source',
        'mentioned_ingredients',
        'trust_score',
        'verdict',
        'is_public',
        'user_id',
        'sentiment',
        'authenticity_score',
        'created_at'
    ];
    
    for (const col of columns) {
        const { data, error } = await supabase.from('reviews').select(col).limit(1);
        if (error) {
            console.log(`❌ Column [${col}] does NOT exist: ${error.message} (${error.code})`);
        } else {
            console.log(`✅ Column [${col}] EXISTS!`);
        }
    }
}

checkLegacyColumns();
