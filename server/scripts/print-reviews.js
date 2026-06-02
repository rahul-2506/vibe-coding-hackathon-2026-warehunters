import { supabase } from '../db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function printReviews() {
    console.log('🔍 Fetching all reviews from Supabase...');
    const { data: reviews, error } = await supabase
        .from('reviews')
        .select('id, rating, review_text, product_id, verdict');

    if (error) {
        console.error('❌ Failed:', error.message);
        return;
    }

    console.log(`Found ${reviews.length} reviews:`);
    reviews.forEach((r, idx) => {
        console.log(`[${idx + 1}] ID: ${r.id}, Rating: ${r.rating}, Product ID: ${r.product_id}, Verdict: ${r.verdict}`);
        console.log(`    Text: "${r.review_text}"\n`);
    });
}

printReviews();
