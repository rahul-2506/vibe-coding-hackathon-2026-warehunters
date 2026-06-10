import rateLimit from 'express-rate-limit';
import { response } from '../utils/response.js';

// Chat APIs: 20 requests/minute
export const chatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    handler: (req, res) => {
        return response.error(res, 'Too many chat requests. Please try again after 60 seconds.', 'Rate limit exceeded', 429);
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// AI endpoints: 20 requests/minute
export const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    handler: (req, res) => {
        return response.error(res, 'Too many AI requests. Please try again after 60 seconds.', 'Rate limit exceeded', 429);
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Review submission: 10 requests/minute
export const reviewLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    handler: (req, res) => {
        return response.error(res, 'Too many review submissions. Please try again after 60 seconds.', 'Rate limit exceeded', 429);
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Auth endpoints: 5 requests/minute
export const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    handler: (req, res) => {
        return response.error(res, 'Too many authentication attempts. Please try again after 60 seconds.', 'Rate limit exceeded', 429);
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Product APIs: 60 requests/minute
export const productsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    handler: (req, res) => {
        return response.error(res, 'Too many product API requests. Please try again after 60 seconds.', 'Rate limit exceeded', 429);
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Admin APIs: 15 requests/minute
export const adminLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 15,
    handler: (req, res) => {
        return response.error(res, 'Too many admin API requests. Please try again after 60 seconds.', 'Rate limit exceeded', 429);
    },
    standardHeaders: true,
    legacyHeaders: false,
});

