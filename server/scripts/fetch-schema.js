import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1/';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

async function fetchSchema() {
    console.log(`📡 FETCHING REMOTE SUPABASE SCHEMAS VIA ${supabaseUrl}...`);
    
    try {
        const res = await fetch(supabaseUrl, {
            headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`
            }
        });
        
        if (!res.ok) {
            throw new Error(`PostgREST OpenAPI query returned status ${res.status}`);
        }
        
        const spec = await res.json();
        console.log('\n==================================================');
        console.log('             REMOTE SCHEMA INVENTORY              ');
        console.log('==================================================');
        
        if (spec.definitions) {
            for (const [name, def] of Object.entries(spec.definitions)) {
                console.log(`\n📦 Table: public.${name}`);
                if (def.properties) {
                    const cols = Object.entries(def.properties).map(([colName, colDef]) => {
                        return `${colName} (${colDef.type}${colDef.format ? ' ' + colDef.format : ''})`;
                    });
                    console.log(`   Columns: ${cols.join(', ')}`);
                } else {
                    console.log(`   (No properties found)`);
                }
            }
        } else {
            console.log('⚠️ No definitions found in OpenAPI spec.');
        }
        console.log('==================================================\n');
    } catch (err) {
        console.error('❌ Failed to fetch remote schemas:', err.message);
    }
}

fetchSchema().catch(console.error);
