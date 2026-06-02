import { supabase } from '../db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkKB() {
    console.log('🔍 Querying knowledge_base from Supabase...');
    const { data, error } = await supabase.from('knowledge_base').select('*');
    if (error) {
        console.error('❌ Query failed:', error.message);
    } else {
        console.log('✅ Query succeeded! Rows found:', data.length);
        if (data.length > 0) {
            console.log('Sample row:', JSON.stringify(data[0]));
        }
    }
}

checkKB();
