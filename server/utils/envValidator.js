import { logger } from './logger.js';

export const envValidator = {
    validate() {
        const requiredVars = [
            'VITE_SUPABASE_URL',
            'VITE_SUPABASE_ANON_KEY',
            'JWT_SECRET'
        ];

        const missing = [];
        for (const v of requiredVars) {
            if (!process.env[v]) {
                missing.push(v);
            }
        }

        if (missing.length > 0) {
            const errorMsg = `CRITICAL ENVIRONMENT ERROR: Missing required env variables: ${missing.join(', ')}`;
            logger.error(errorMsg, new Error(errorMsg), 'ENV_VALIDATION');
            console.error('\x1b[31m%s\x1b[0m', '==================================================');
            console.error('\x1b[31m%s\x1b[0m', '      FATAL: MISSING REQUIRED CONFIGURATION       ');
            console.error('\x1b[31m%s\x1b[0m', '==================================================');
            console.error('\x1b[31m%s\x1b[0m', `Required: ${missing.join(', ')}`);
            console.error('\x1b[31m%s\x1b[0m', 'Please verify your server/.env or root .env files.');
            console.error('\x1b[31m%s\x1b[0m', '==================================================');
            process.exit(1);
        }

        logger.info('Supabase environment variables validated successfully.', 'ENV_VALIDATION');
    }
};
