import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder.supabase.co')) {
    const errorMsg = "CRITICAL INITIALIZATION ERROR: Supabase credentials (SUPABASE_URL and SUPABASE_ANON_KEY) must be defined and cannot contain placeholder values.";
    console.error('\x1b[31m%s\x1b[0m', '==================================================');
    console.error('\x1b[31m%s\x1b[0m', '  FATAL: INVALID OR MISSING DATABASE CREDENTIALS  ');
    console.error('\x1b[31m%s\x1b[0m', '==================================================');
    console.error('\x1b[31m%s\x1b[0m', errorMsg);
    console.error('\x1b[31m%s\x1b[0m', '==================================================');
    throw new Error(errorMsg);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const db = {
    supabase,
    
    async initialize() {
        logger.info('[DB] Supabase database client verified and active.', 'DATABASE');
        
        // Basic connection test
        try {
            const { data, error } = await supabase.from('products').select('id').limit(1);
            if (error) {
                logger.error('[DB] Supabase initial query failed. Verify database schemas and credentials.', error, 'DATABASE');
                throw error;
            }
            logger.info('[DB] Supabase schema connectivity test passed.', 'DATABASE');
        } catch (err) {
            logger.error(`[DB] Supabase health test failed: ${err.message}. Mandating active connection.`, 'DATABASE');
            throw err;
        }
    }
};

export default db;
export { supabaseUrl, supabaseAnonKey };
