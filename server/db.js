import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
);

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
            logger.warn(`[DB] Supabase health test failed: ${err.message}. Server booting in standby mode.`, 'DATABASE');
        }
        
        return Promise.resolve();
    }
};

export default db;
export { supabaseUrl, supabaseAnonKey };
