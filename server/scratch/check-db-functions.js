import { supabase } from '../db.js';

async function checkSqlRpc() {
    try {
        console.log('Checking for SQL RPC function...');
        const { data, error } = await supabase.rpc('exec_sql', {
            query: 'SELECT 1'
        });
        if (error) {
            console.log('exec_sql check error:', error.message);
        } else {
            console.log('exec_sql exists! Result:', data);
        }
    } catch (e) {
        console.log('exec_sql exception:', e.message);
    }
}

checkSqlRpc();
