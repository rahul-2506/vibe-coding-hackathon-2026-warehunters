import { logger } from '../utils/logger.js';
import { response } from '../utils/response.js';

export function errorMiddleware(err, req, res, next) {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'An unexpected server error occurred';
    const errorCode = err.code || err.errorCode || null;
    
    // Log detailed error stack
    logger.error(`Error processing request: ${req.method} ${req.originalUrl}`, err, 'APP');
    
    return response.error(res, message, errorCode, status);
}
