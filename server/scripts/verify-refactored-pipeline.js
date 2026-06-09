import { supabase } from '../db.js';
import { productService } from '../services/productService.js';
import { vectorSearchService } from '../services/vectorSearchService.js';
import { approvedFeed } from '../services/productAggregator/approvedFeed.js';

async function runVerification() {
    console.log('🧪 STARTING END-TO-END PIPELINE VERIFICATION...');
    console.log('==================================================');

    // Step 1: Database Table Existence and Schema Check
    console.log('\nStep 1: Checking database detail tables...');
    
    const checkTable = async (tableName) => {
        const { error, status } = await supabase.from(tableName).select('*').limit(1);
        if (error && error.code === 'PGRST205') {
            return { exists: false, error: error.message };
        }
        return { exists: true, status };
    };

    const skincareCheck = await checkTable('skincare_details');
    const electronicsCheck = await checkTable('electronics_details');

    console.log(`- Table [skincare_details]: ${skincareCheck.exists ? '✅ PRESENT' : '❌ MISSING (' + skincareCheck.error + ')'}`);
    console.log(`- Table [electronics_details]: ${electronicsCheck.exists ? '✅ PRESENT' : '❌ MISSING (' + electronicsCheck.error + ')'}`);

    if (!skincareCheck.exists || !electronicsCheck.exists) {
        console.warn('\n⚠️  WARNING: Category details tables are not yet created in the database.');
        console.warn('Please execute the migration script in your Supabase SQL Editor:');
        console.warn('👉 database/migrations/phase6_refactor_product_system.sql');
        console.warn('Stopping verification test. Run this script again after the migration.');
        process.exit(0);
    }

    // Step 2: Seeder Check / Catalog Sync
    console.log('\nStep 2: Testing productService.getAllProducts() and seeder...');
    try {
        const products = await productService.getAllProducts();
        console.log(`- Product count in database: ${products.length}`);
        console.log(`- Expected approvedFeed size: ${approvedFeed.length}`);
        
        if (products.length === approvedFeed.length) {
            console.log('✅ Catalog count matches approvedFeed size perfectly.');
        } else {
            console.log('ℹ️ Catalog count mismatch. Seeder will run on next request to auto-heal.');
        }

        // Validate that no forbidden categories are present
        const categories = new Set(products.map(p => p.category));
        console.log(`- Categories found in database products: ${Array.from(categories).join(', ')}`);
        
        const invalidCats = Array.from(categories).filter(c => c !== 'Skincare' && c !== 'Electronics');
        if (invalidCats.length === 0) {
            console.log('✅ Category restrictions are fully enforced: Only Skincare and Electronics exist.');
        } else {
            console.error(`❌ ERROR: Found unsupported categories in database: ${invalidCats.join(', ')}`);
        }
    } catch (e) {
        console.error('❌ ERROR loading products:', e.message);
    }

    // Step 3: Relational Details Expansion Check
    console.log('\nStep 3: Checking details table joins and flattener...');
    try {
        const products = await productService.getAllProducts();
        
        const skincareSample = products.find(p => p.category === 'Skincare');
        const electronicsSample = products.find(p => p.category === 'Electronics');

        if (skincareSample) {
            console.log(`- Skincare product sample: "${skincareSample.title}"`);
            console.log(`  * ingredients: ${skincareSample.ingredients ? '✅ populated' : '❌ missing'}`);
            console.log(`  * key_ingredients: ${skincareSample.key_ingredients ? '✅ populated' : '❌ missing'}`);
            console.log(`  * skin_type: ${skincareSample.skin_type ? '✅ populated' : '❌ missing'}`);
            console.log(`  * concerns: ${skincareSample.concerns ? '✅ populated' : '❌ missing'}`);
            if (skincareSample.ingredients && skincareSample.skin_type) {
                console.log('✅ Skincare details joins and flattener are operational.');
            }
        } else {
            console.log('⚠️ No skincare product found in database to inspect.');
        }

        if (electronicsSample) {
            console.log(`- Electronics product sample: "${electronicsSample.title}"`);
            console.log(`  * specifications_json: ${Object.keys(electronicsSample.specifications_json).length > 0 ? '✅ populated' : '❌ missing'}`);
            console.log(`  * technical_features: ${electronicsSample.technical_features ? '✅ populated' : '❌ missing'}`);
            if (Object.keys(electronicsSample.specifications_json).length > 0 && electronicsSample.technical_features) {
                console.log('✅ Electronics details joins and flattener are operational.');
            }
        } else {
            console.log('⚠️ No electronics product found in database to inspect.');
        }
    } catch (e) {
        console.error('❌ ERROR checking details joins:', e.message);
    }

    // Step 4: Semantic Vector Search Check
    console.log('\nStep 4: Testing 7-Stage Semantic Vector Search...');
    try {
        const query = 'moisturizer with ceramides for dry skin';
        console.log(`- Executing semantic search for query: "${query}"`);
        const searchResults = await vectorSearchService.semanticSearch(query, 'All', null, 3);
        
        console.log(`- Results returned: ${searchResults.length}`);
        searchResults.forEach((p, idx) => {
            console.log(`  [${idx + 1}] Title: "${p.title}" (Category: ${p.category}, Price: ₹${p.price})`);
            if (p.category === 'Skincare') {
                console.log(`      Actives: ${p.key_ingredients || 'None'}`);
            }
        });

        const isSkincareMatch = searchResults.every(p => p.category === 'Skincare');
        if (isSkincareMatch && searchResults.length > 0) {
            console.log('✅ Category intent routing and metadata filters are operational.');
        } else if (searchResults.length > 0) {
            console.log('⚠️ Mixed category results returned. Verify query routing or pgvector match threshold.');
        }
    } catch (e) {
        console.error('❌ ERROR testing semantic search:', e.message);
    }

    console.log('\n==================================================');
    console.log('🏁 VERIFICATION PIPELINE SHUTDOWN.');
}

runVerification().catch(err => {
    console.error('Fatal test execution failure:', err);
});
