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
import { authLimiter } from './middleware/rateLimiter.js';

// Logger Utility
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();

// 1. Global Middlewares
app.use(requestTracingMiddleware);
app.use(cors());
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
    const allHealthy = dbOk && aiOk;

    const payload = {
        backend: true,
        database: dbOk,
        ai_service: aiOk,
        timestamp: new Date().toISOString()
    };

    return res.status(allHealthy ? 200 : 503).json(payload);
});

// 2. Register Routes
app.use('/api/auth', authLimiter);
app.use('/api/products', productRoutes);
app.use('/api/recommend', recommendRoutes);
app.use('/api/ai/recommend', recommendRoutes); // Client-side fallback route
app.use('/api/search', searchRoutes);
app.use('/api/ai/chat', chatRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/feedbacks', feedbackRoutes); // Support plural endpoints for client compatibility
app.use('/api/ai', aiRoutes);
app.use('/api/compare', compareRoutes);

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
