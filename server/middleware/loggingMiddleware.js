import { logger } from '../utils/logger.js';

export function loggingMiddleware(req, res, next) {
    const start = Date.now();
    
    // Log request entry
    logger.info(`${req.method} ${req.originalUrl} - Received`, 'HTTP');
    
    // Attach listener to request termination to log duration and status
    res.on('finish', () => {
        const duration = Date.now() - start;
        const msg = `${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`;
        
        if (res.statusCode >= 500) {
            logger.error(msg, null, 'HTTP');
        } else if (res.statusCode >= 400) {
            logger.warn(msg, 'HTTP');
        } else {
            logger.info(msg, 'HTTP');
        }
    });

    next();
}
