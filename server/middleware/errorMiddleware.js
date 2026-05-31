import { logger } from '../utils/logger.js';
import { response } from '../utils/response.js';

export function errorMiddleware(err, req, res, next) {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'An unexpected server error occurred';
    
    // Log detailed error stack
    logger.error(`Error processing request: ${req.method} ${req.originalUrl}`, err, 'APP');
    
    // Return formatted error wrapper
    const details = process.env.NODE_ENV === 'development' ? err.stack : null;
    return response.error(res, message, details, status);
}
