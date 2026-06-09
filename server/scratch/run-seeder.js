import { productService } from '../services/productService.js';
import { supabase } from '../db.js';

async function runSeeder() {
    try {
        console.log('Triggering productService.getAllProducts() to start seeder...');
        const products = await productService.getAllProducts();
        console.log('Successfully loaded products!');
        console.log('Count returned:', products.length);

        // Fetch count directly from DB
        const { count, error } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error('Error fetching count directly:', error.message);
        } else {
            console.log('Direct count in DB now:', count);
        }
    } catch (e) {
        console.error('Exception during seeding:', e);
    }
}

runSeeder();
