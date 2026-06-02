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

        // 3. Validate SUPABASE_URL
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
            missing.push('SUPABASE_URL');
        } else if (supabaseUrl.includes('placeholder.supabase.co')) {
            errors.push('SUPABASE_URL cannot be a placeholder value.');
        }

        // 4. Validate SUPABASE_ANON_KEY
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseAnonKey) {
            missing.push('SUPABASE_ANON_KEY');
        } else if (supabaseAnonKey === 'placeholder' || supabaseAnonKey === 'placeholder_anon_key') {
            errors.push('SUPABASE_ANON_KEY cannot be a placeholder value.');
        }

        // 5. Validate SUPABASE_SERVICE_ROLE_KEY
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseServiceRoleKey) {
            // Optional warning, or log message, but since it is requested in list, let's validate it
            logger.warn('SUPABASE_SERVICE_ROLE_KEY is not defined in environment. Backend will operate in standard anon user scope.', 'ENV_VALIDATION');
        }

        // 6. Validate AI API Keys (Must have at least one valid key to function, let's ensure we check them)
        const geminiKey = process.env.GEMINI_API_KEY;
        const groqKey = process.env.GROQ_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;

        if (!geminiKey && !groqKey && !openaiKey) {
            missing.push('GEMINI_API_KEY / GROQ_API_KEY / OPENAI_API_KEY (At least one AI Engine key must be active)');
        }

        // 7. Validate FRONTEND_URL
        const frontendUrl = process.env.FRONTEND_URL;
        if (!frontendUrl) {
            missing.push('FRONTEND_URL');
        } else if (frontendUrl.includes('placeholder') || frontendUrl === '') {
            errors.push('FRONTEND_URL cannot be a placeholder value.');
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
