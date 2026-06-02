import { supabase } from '../db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function cleanReviews() {
    console.log('🧹 Fetching all reviews from Supabase first...');
    const { data: reviews, error: fetchError } = await supabase
        .from('reviews')
        .select('id, rating, review_text, product_id');

    if (fetchError) {
        console.error('❌ Failed to fetch reviews:', fetchError.message);
        return;
    }

    console.log(`Found ${reviews.length} reviews to delete.`);
    if (reviews.length === 0) {
        console.log('✅ Nothing to delete!');
        return;
    }

    const ids = reviews.map(r => r.id);
    console.log('Attempting to delete IDs:', ids);

    // Delete by IDs
    const { error: deleteError } = await supabase
        .from('reviews')
        .delete()
        .in('id', ids);

    if (deleteError) {
        console.error('❌ Delete operation failed:', deleteError.message);
        console.log('Retrying delete one by one to isolate failures...');
        for (const review of reviews) {
            const { error: singleErr } = await supabase
                .from('reviews')
                .delete()
                .eq('id', review.id);
            if (singleErr) {
                console.error(`❌ Failed to delete review ID ${review.id}:`, singleErr.message);
            } else {
                console.log(`✅ Deleted review ID ${review.id}`);
            }
        }
    } else {
        console.log('✅ Delete operation succeeded! All reviews purged.');
    }
}

cleanReviews();
