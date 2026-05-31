import { logger } from './logger.js';

export const envValidator = {
    /**
     * Loudly validates the presence and formatting of all production-grade requirements.
     * Exits immediately (Code 1) if any configuration is crippled or contains placeholder strings.
     */
    validate() {
        const missing = [];
        const errors = [];

        // 1. Validate PORT
        const port = process.env.PORT;
        if (!port) {
            missing.push('PORT');
        }

        // 2. Validate JWT_SECRET
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            missing.push('JWT_SECRET');
        } else if (jwtSecret.includes('your_jwt_secret_key_here') || jwtSecret === 'placeholder') {
            errors.push('JWT_SECRET cannot be a placeholder value.');
        }

        // 3. Validate SUPABASE_URL (accepts VITE_SUPABASE_URL or SUPABASE_URL)
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
            missing.push('SUPABASE_URL / VITE_SUPABASE_URL');
        } else if (supabaseUrl.includes('placeholder.supabase.co')) {
            errors.push('SUPABASE_URL cannot be a placeholder value.');
        }

        // 4. Validate SUPABASE_KEY (accepts SUPABASE_KEY or VITE_SUPABASE_ANON_KEY)
        const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseKey) {
            missing.push('SUPABASE_KEY / VITE_SUPABASE_ANON_KEY');
        } else if (supabaseKey === 'placeholder' || supabaseKey === 'placeholder_anon_key') {
            errors.push('SUPABASE_KEY cannot be a placeholder value.');
        }

        // 5. Validate AI_API_KEY (accepts GEMINI_API_KEY or GROQ_API_KEY or AI_API_KEY)
        const aiApiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;
        if (!aiApiKey) {
            missing.push('AI_API_KEY (GEMINI_API_KEY or GROQ_API_KEY)');
        }

        // Halt startup immediately on failures
        if (missing.length > 0 || errors.length > 0) {
            console.error('\x1b[31m%s\x1b[0m', '==================================================');
            console.error('\x1b[31m%s\x1b[0m', '  FATAL: CRITICAL ENVIRONMENT CONFIGURATION ERROR ');
            console.error('\x1b[31m%s\x1b[0m', '==================================================');
            
            if (missing.length > 0) {
                console.error('\x1b[31m%s\x1b[0m', `❌ Missing Variables: ${missing.join(', ')}`);
            }
            if (errors.length > 0) {
                errors.forEach(err => console.error('\x1b[31m%s\x1b[0m', `❌ Config Error: ${err}`));
            }
            
            console.error('\x1b[31m%s\x1b[0m', '==================================================');
            console.error('\x1b[31m%s\x1b[0m', 'The application refuses to boot with insecure configurations.');
            console.error('\x1b[31m%s\x1b[0m', 'Please verify your server/.env environment configuration.');
            console.error('\x1b[31m%s\x1b[0m', '==================================================');
            
            const errorStr = `Loud boot crash due to environment validation failures. Missing: ${missing.join(', ')}. Errors: ${errors.join('; ')}`;
            logger.error(errorStr, new Error(errorStr), 'ENV_VALIDATION');
            process.exit(1);
        }

        logger.info('Structured environment configurations validated successfully. All systems clear for boot.', 'ENV_VALIDATION');
    }
};
