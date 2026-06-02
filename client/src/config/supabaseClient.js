import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder.supabase.co'));

let supabaseInstance = null;

if (isConfigured) {
    try {
        supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    } catch (e) {
        console.error("Failed to initialize Supabase client:", e);
    }
}

if (!supabaseInstance) {
    console.warn("Supabase is not configured or failed to initialize. Running in offline/demo fallback mode.");
    
    // Resilient mock object to prevent application crashes
    supabaseInstance = {
        auth: {
            getSession: async () => ({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signUp: async () => ({ data: { user: null }, error: new Error("Offline fallback mode: Registration disabled.") }),
            signInWithPassword: async () => ({ data: { user: null }, error: new Error("Offline fallback mode: Sign in disabled.") }),
            signInWithOAuth: async () => ({ data: null, error: new Error("Offline fallback mode: Google login disabled.") }),
            signOut: async () => {
                window.location.assign('/auth');
                return { error: null };
            },
            getUser: async () => ({ data: { user: null }, error: null })
        },
        from: () => ({
            select: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
                eq: () => ({
                    single: () => Promise.resolve({ data: null, error: null }),
                    order: () => Promise.resolve({ data: [], error: null })
                }),
                order: () => Promise.resolve({ data: [], error: null }),
                single: () => Promise.resolve({ data: null, error: null })
            }),
            insert: () => Promise.resolve({ data: null, error: new Error("Offline fallback mode: Insertion disabled.") }),
            upsert: () => Promise.resolve({ data: null, error: new Error("Offline fallback mode: Upsert disabled.") }),
            update: () => ({
                eq: () => ({
                    select: () => ({
                        single: () => Promise.resolve({ data: null, error: new Error("Offline fallback mode: Updates disabled.") })
                    })
                })
            }),
            delete: () => Promise.resolve({ data: null, error: new Error("Offline fallback mode: Deletion disabled.") })
        })
    };
}

export const supabase = supabaseInstance;
export const supabaseConfigured = isConfigured;
