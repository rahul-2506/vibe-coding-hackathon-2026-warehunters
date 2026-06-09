import { supabase } from '../db.js';

async function listColumns() {
    try {
        console.log('Fetching one row from products...');
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Error fetching row:', error.message);
            return;
        }

        if (data && data.length > 0) {
            console.log('Row fields:', Object.keys(data[0]));
            console.log('Full Row:', data[0]);
        } else {
            console.log('No rows returned.');
        }
    } catch (e) {
        console.error('Exception:', e.message);
    }
}

listColumns();
