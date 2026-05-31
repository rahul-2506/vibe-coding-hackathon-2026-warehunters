import { supabase } from '../db.js';

async function testSelect() {
    console.log('Querying reviews from Supabase...');
    const { data, error } = await supabase.from('reviews').select('*');
    if (error) {
        console.error('❌ Query failed:', error.message);
    } else {
        console.log('✅ Query succeeded! Rows found:', data.length);
        if (data.length > 0) {
            console.log('Sample row:', JSON.stringify(data[0]));
        }
    }
}

testSelect();
