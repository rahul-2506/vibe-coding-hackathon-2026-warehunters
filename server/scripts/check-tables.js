import { supabase } from '../db.js';

async function check() {
    console.log('🔍 Checking schemas in remote Supabase instance...');
    
    // We can list tables by querying information_schema via a postgrest call, if enabled,
    // or by attempting to do a select query.
    
    const checkTable = async (tableName) => {
        try {
            const { data, error, status } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);
            
            console.log(`Table [${tableName}]:`);
            console.log(`  - HTTP Status: ${status}`);
            console.log(`  - Error: ${error ? JSON.stringify(error) : 'None'}`);
            console.log(`  - Data length: ${data ? data.length : 'N/A'}`);
        } catch (e) {
            console.error(`  - Exception:`, e.message);
        }
    };

    await checkTable('products');
    await checkTable('user_memories');
    await checkTable('skincare_details');
    await checkTable('electronics_details');
}

check().catch(console.error);
