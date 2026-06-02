import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from './logger.js';

// Resolve JWT Secret from env or generate a cryptographically secure random 64-byte key on startup
let resolvedJwtSecret = process.env.JWT_SECRET;
if (!resolvedJwtSecret || resolvedJwtSecret === 'placeholder' || resolvedJwtSecret === 'your_jwt_secret_key_here') {
    resolvedJwtSecret = crypto.randomBytes(64).toString('hex');
    logger.warn('[JWT] Insecure or missing JWT_SECRET. Generated a cryptographically secure fallback secret key for this process session.', 'SECURITY');
}

const DEFAULT_OPTIONS = {
    issuer: 'ReviewLens-Auth-Authority',
    audience: 'ReviewLens-Ecom-Client',
    expiresIn: '24h'
};

export const jwtHelper = {
    /**
     * Signs a secure JWT token containing user payload.
     * @param {Object} payload User payload (e.g. { id, email, role })
     * @param {Object} [options] Custom JWT signing options
     * @returns {string} Signed JWT token
     */
    sign(payload, options = {}) {
        try {
            const signOptions = { ...DEFAULT_OPTIONS, ...options };
            return jwt.sign(payload, resolvedJwtSecret, signOptions);
        } catch (err) {
            logger.error('[JWT SIGN ERROR] Failed to sign token', err, 'SECURITY');
            throw new Error(`Token generation failed: ${err.message}`);
        }
    },

    /**
     * Verifies a JWT token structure and signature.
     * @param {string} token Signed JWT token
     * @param {Object} [options] Custom JWT verification options
     * @returns {Object} Decoded user payload
     */
    verify(token, options = {}) {
        try {
            const verifyOptions = {
                issuer: DEFAULT_OPTIONS.issuer,
                audience: DEFAULT_OPTIONS.audience,
                ...options
            };
            return jwt.verify(token, resolvedJwtSecret, verifyOptions);
        } catch (err) {
            logger.warn(`[JWT VERIFICATION FAILURE] Token verification failed: ${err.message}`, 'SECURITY');
            throw err;
        }
    }
};
