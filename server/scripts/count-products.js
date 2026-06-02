import { supabase } from '../db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function countProducts() {
    console.log('🔍 Querying products count from Supabase...');
    const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('❌ Count failed:', error.message);
    } else {
        console.log('✅ Count succeeded! Total products in database:', count);
    }
}

countProducts();
