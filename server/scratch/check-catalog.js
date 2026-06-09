import { supabase } from '../db.js';
import { approvedFeed } from '../services/productAggregator/approvedFeed.js';

async function checkCatalog() {
    try {
        console.log('Querying Supabase products table...');
        const { data, count, error } = await supabase
            .from('products')
            .select('*', { count: 'exact' });

        if (error) {
            console.error('Error fetching products:', error.message);
            return;
        }

        console.log('-------------------------------');
        console.log('Products Count in DB:', count || (data ? data.length : 0));
        console.log('Approved Feed Length:', approvedFeed.length);
        console.log('-------------------------------');

        if (data && data.length > 0) {
            console.log('First 5 Products in DB:');
            data.slice(0, 5).forEach(p => {
                console.log(`- ID: ${p.id}, Name: "${p.name}", Category: "${p.category}", Price: ${p.price}`);
            });
            console.log('Last 5 Products in DB:');
            data.slice(-5).forEach(p => {
                console.log(`- ID: ${p.id}, Name: "${p.name}", Category: "${p.category}", Price: ${p.price}`);
            });
        } else {
            console.log('No products found in DB.');
        }
        console.log('-------------------------------');
    } catch (e) {
        console.error('Exception:', e.message);
    }
}

checkCatalog();
