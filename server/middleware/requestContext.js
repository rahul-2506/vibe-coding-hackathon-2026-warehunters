import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';

export const requestContext = new AsyncLocalStorage();

/**
 * Middleware that generates a unique correlation ID for every incoming request
 * and runs downstream handlers inside the context of AsyncLocalStorage.
 */
export function requestTracingMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    
    // Attach to request and response headers
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    // Run the remaining execution chain inside AsyncLocalStorage context
    requestContext.run({ requestId }, () => {
        next();
    });
}
