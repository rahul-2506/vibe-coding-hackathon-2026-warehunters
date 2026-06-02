import { supabase } from '../db.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function initializeDatabase() {
    console.log('==================================================');
    console.log('       REVIEWLENS DATABASE INITIALIZATION         ');
    console.log('==================================================\n');

    // Tables to check
    const tables = [
        { name: 'profiles', query: supabase.from('profiles').select('*').limit(1) },
        { name: 'products', query: supabase.from('products').select('*').limit(1) },
        { name: 'reviews', query: supabase.from('reviews').select('*').limit(1) },
        { name: 'chat_sessions', query: supabase.from('chat_sessions').select('*').limit(1) },
        { name: 'chat_messages', query: supabase.from('chat_messages').select('*').limit(1) },
        { name: 'user_preferences', query: supabase.from('user_preferences').select('*').limit(1) }
    ];

    logger.info('Auditing Supabase database table integrations...', 'DATABASE_INIT');

    const results = [];
    let migrationsRequired = false;

    for (const table of tables) {
        try {
            const { error } = await table.query;
            if (error) {
                const exists = error.code !== '42P01'; // 42P01: Table does not exist
                if (!exists) {
                    migrationsRequired = true;
                }
                results.push({ name: table.name, exists, error: error.message });
            } else {
                results.push({ name: table.name, exists: true, error: null });
            }
        } catch (err) {
            results.push({ name: table.name, exists: false, error: err.message });
            migrationsRequired = true;
        }
    }

    console.log('--------------------------------------------------');
    console.log('                 SCHEMA STATUS                    ');
    console.log('--------------------------------------------------');
    for (const r of results) {
        const icon = r.exists ? '✅' : '❌';
        console.log(`${icon} Table [${r.name}]: ${r.exists ? 'VERIFIED' : 'NOT FOUND'}`);
        if (!r.exists) {
            console.log(`   - Details: ${r.error}`);
        }
    }
    console.log('');

    if (migrationsRequired) {
        console.log('==================================================');
        console.log(' ⚠️  ATTENTION: SCHEMA MIGRATIONS REQUIRED         ');
        console.log('==================================================');
        console.log('New persistent session memory tables are missing.');
        console.log('To apply these tables, please execute the SQL migration script located at:');
        console.log(` -> database/migrations/01_session_memory.sql`);
        console.log('\nYou can copy and paste the contents of this file directly into the');
        console.log('Supabase SQL Editor dashboard to create these tables.');
        console.log('==================================================\n');
    } else {
        console.log('==================================================');
        console.log(' 🎉 SUCCESS: DATABASE SCHEMA MAPPED & VALIDATED     ');
        console.log('==================================================\n');
    }
}

initializeDatabase().catch(err => {
    console.error('Fatal database initialization failure:', err);
});
