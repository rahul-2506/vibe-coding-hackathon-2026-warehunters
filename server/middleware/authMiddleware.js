import { supabase } from '../db.js';
import { response } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            logger.warn(`[AUTH] Unauthorized request to ${req.originalUrl} - Missing authorization header`, 'AUTH');
            return response.error(res, 'Access Denied: No Authorization header provided.', null, 401);
        }

        const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
        if (!token) {
            logger.warn(`[AUTH] Unauthorized request to ${req.originalUrl} - Missing token in header`, 'AUTH');
            return response.error(res, 'Access Denied: No Bearer token provided.', null, 401);
        }

        // Verify session token against Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            logger.warn(`[AUTH] Unauthorized request to ${req.originalUrl} - Invalid or expired token: ${error?.message || 'No user'}`, 'AUTH');
            return response.error(res, 'Access Denied: Invalid or expired Supabase session token.', error?.message || null, 401);
        }

        // Attach user object to the request for controller access if needed
        req.user = user;
        logger.info(`[AUTH] Authorized request to ${req.originalUrl} for user: ${user.email}`, 'AUTH');
        next();
    } catch (err) {
        logger.error(`[AUTH] Authentication middleware internal error: ${err.message}`, err, 'AUTH');
        return response.error(res, 'Authentication internal error', err.message, 500);
    }
}
