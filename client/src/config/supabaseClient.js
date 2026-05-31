import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder.supabase.co')) {
    throw new Error("CRITICAL CLIENT ERROR: Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are missing or contain invalid placeholder values. Please check your client/.env configuration.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
