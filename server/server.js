import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db.js';

// Centralized Middlewares
import { loggingMiddleware } from './middleware/loggingMiddleware.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';
import { requestTracingMiddleware } from './middleware/requestContext.js';

// Environment variable validator
import { envValidator } from './utils/envValidator.js';

// Modular Routers
import productRoutes from './routes/products.js';
import recommendRoutes from './routes/recommend.js';
import chatRoutes from './routes/chat.js';
import searchRoutes from './routes/search.js';
import feedbackRoutes from './routes/feedback.js';
import aiRoutes from './routes/ai.js';
import compareRoutes from './routes/compare.js';

// AI Service
import { aiService } from './services/aiService.js';

// Rate Limiting Middlewares
import { authLimiter, chatLimiter, reviewLimiter, productsLimiter, aiLimiter } from './middleware/rateLimiter.js';

// Logger Utility
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();

// 1. Global Middlewares
app.use(requestTracingMiddleware);

const allowedOrigins = new Set();
const frontendUrl = process.env.FRONTEND_URL;
const envAllowedOrigins = process.env.ALLOWED_ORIGINS;

if (envAllowedOrigins) {
    envAllowedOrigins.split(',').forEach(origin => {
        if (origin.trim()) allowedOrigins.add(origin.trim());
    });
} else {
    // Standard deployment-safe development defaults
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://localhost:5173');
}

if (frontendUrl) {
    allowedOrigins.add(frontendUrl.trim());
}

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) {
            return callback(null, true);
        } else {
            logger.warn(`Rejected origin by CORS: ${origin}`, 'SECURITY');
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(loggingMiddleware);

// Centralized Health Check Endpoint
app.get('/api/health', async (req, res) => {
    let dbOk = false;
    try {
        const { error } = await db.supabase.from('products').select('id').limit(1);
        dbOk = !error;
    } catch (e) {
        dbOk = false;
    }

    const aiOk = await aiService.verifyAIHealth();
    
    let statusCode = 200;
    let status = "healthy";
    
    if (!dbOk) {
        statusCode = 503;
        status = "failed";
    } else if (!aiOk) {
        statusCode = 200;
        status = "degraded";
    }

    const payload = {
        backend: true,
        database: dbOk,
        ai_service: aiOk,
        status: status,
        timestamp: new Date().toISOString()
    };

    return res.status(statusCode).json(payload);
});

// 2. Register Routes
app.use('/api/auth', authLimiter);
app.use('/api/products', productsLimiter, productRoutes);
app.use('/api/recommend', aiLimiter, recommendRoutes);

// Redirect duplicate `/api/ai/recommend` -> `/api/recommend` to choose one canonical version
app.all('/api/ai/recommend*', (req, res) => {
    const newPath = req.originalUrl.replace('/api/ai/recommend', '/api/recommend');
    res.redirect(307, newPath);
});

app.use('/api/search', productsLimiter, searchRoutes);
app.use('/api/ai/chat', aiLimiter, chatRoutes);
app.use('/api/feedback', feedbackRoutes);

// Redirect duplicate `/api/feedbacks` -> `/api/feedback` to choose one canonical version
app.all('/api/feedbacks*', (req, res) => {
    const newPath = req.originalUrl.replace('/api/feedbacks', '/api/feedback');
    res.redirect(307, newPath);
});

app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/compare', aiLimiter, compareRoutes);

// 3. Centralized Universal Error Handler Middleware
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;
let serverInstance = null;

// 4. Validate Environment Variables on Startup
envValidator.validate();

// 5. Database Initialization & Startup
logger.info('Awaiting database verification...', 'BOOT');
db.initialize()
    .then(() => {
        serverInstance = app.listen(PORT, () => {
            logger.info(`Server successfully booted and listening on http://localhost:${PORT}`, 'BOOT');
        });
    })
    .catch(err => {
        console.error('\x1b[31m%s\x1b[0m', '==================================================');
        console.error('\x1b[31m%s\x1b[0m', '  FATAL ERROR: DATABASE INITIALIZATION FAILED     ');
        console.error('\x1b[31m%s\x1b[0m', '==================================================');
        console.error('\x1b[31m%s\x1b[0m', `The server failed to connect to Supabase: ${err.message}`);
        console.error('\x1b[31m%s\x1b[0m', 'Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
        console.error('\x1b[31m%s\x1b[0m', '==================================================');
        logger.error('Fatal database initialization error. Shutting down process loudly.', err, 'BOOT');
        process.exit(1);
    });

// 6. Graceful Lifecycle Shutdown Handler
async function handleGracefulShutdown(signal) {
    logger.warn(`Received lifecycle signal ${signal}. Starting graceful application teardown...`, 'LIFECYCLE');
    
    if (serverInstance) {
        logger.info('Draining active HTTP server connections...', 'LIFECYCLE');
        serverInstance.close(() => {
            logger.info('HTTP server has been closed successfully.', 'LIFECYCLE');
        });
    }

    try {
        logger.info('Closing database connections...', 'LIFECYCLE');
        logger.info('Database client closed safely.', 'LIFECYCLE');
    } catch (dbErr) {
        logger.error('Failed to close database safely during shutdown', dbErr, 'LIFECYCLE');
    }

    logger.warn('Teardown complete. Exiting process.', 'LIFECYCLE');
    process.exit(0);
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

// 7. Global Process Error Handlers for Unhandled Rejections and Exceptions
process.on('uncaughtException', (err) => {
    logger.error('CRITICAL: Uncaught Exception detected in process lifecycle!', err, 'CRITICAL');
    logger.warn('Triggering graceful shutdown due to uncaughtException...', 'LIFECYCLE');
    handleGracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('CRITICAL: Unhandled Promise Rejection detected!', reason instanceof Error ? reason : new Error(String(reason)), 'CRITICAL');
});
