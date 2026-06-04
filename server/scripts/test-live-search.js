import { productSearch } from '../src/tools/productSearch.js';
import { supabase } from '../db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function runLiveSearchTest() {
    console.log("==================================================");
    console.log("   LIVE PRODUCT RETRIEVAL & CACHING TEST SUITE    ");
    console.log("==================================================\n");

    const queryTerm = "Retinol Cleanser Complex";
    console.log(`🔍 1. Triggering live search for non-existent product: "${queryTerm}"...`);

    const result = await productSearch.search({
        query: queryTerm,
        category: "Skincare & Beauty"
    }, {
        geminiKey: process.env.GEMINI_API_KEY,
        groqKey: process.env.GROQ_API_KEY
    });

    console.log(`\n📦 Search Result Structure:`, JSON.stringify(result, null, 2));

    if (result.success && result.products && result.products.length > 0) {
        console.log(`\n✅ 2. Live Search Succeeded! Found ${result.products.length} products.`);
        
        const firstProd = result.products[0];
        console.log(`Checking if "${firstProd.title}" was saved to Supabase db...`);

        const { data: dbProd, error } = await supabase
            .from('products')
            .select('*')
            .eq('title', firstProd.title)
            .limit(1);

        if (error) {
            console.error(`❌ DB Query failed: ${error.message}`);
        } else if (dbProd && dbProd.length > 0) {
            console.log(`\n🎉 3. DB Verification Success! Product exists in DB with ID: ${dbProd[0].id}`);
            console.log(`Title: ${dbProd[0].title}`);
            console.log(`Price: $${dbProd[0].price}`);
            console.log(`Rating: ${dbProd[0].rating}`);
            
            // Check if reviews were cached
            const { data: dbReviews, error: revErr } = await supabase
                .from('reviews')
                .select('id, rating, review_text')
                .eq('product_id', dbProd[0].id);

            if (!revErr && dbReviews) {
                console.log(`💬 Cached reviews count: ${dbReviews.length}`);
                dbReviews.forEach((r, idx) => {
                    console.log(`   [Review ${idx+1}] Rating: ${r.rating} | Text: "${r.review_text}"`);
                });
            }
        } else {
            console.warn(`⚠️ Product "${firstProd.title}" was not found in the DB. Check if DB inserts are active.`);
        }
    } else {
        console.error(`❌ Search failed:`, result.error || "No products returned");
    }
    
    process.exit(0);
}

runLiveSearchTest().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});
