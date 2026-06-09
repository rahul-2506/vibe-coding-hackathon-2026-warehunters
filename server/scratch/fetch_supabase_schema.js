import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function fetchSchema() {
    try {
        console.log(`URL: ${supabaseUrl}`);
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`
            }
        });
        const data = await response.json();
        console.log('Available REST Paths:');
        console.log(Object.keys(data.paths).filter(p => p.startsWith('/rpc/')));
        console.log('\nDefinitions (Tables):');
        console.log(Object.keys(data.definitions));
    } catch (e) {
        console.error(e);
    }
}

fetchSchema();
