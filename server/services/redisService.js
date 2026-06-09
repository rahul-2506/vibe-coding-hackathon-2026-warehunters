import { logger } from '../utils/logger.js';

// Simple In-Memory Cache Store with TTL support
class InMemoryCache {
    constructor() {
        this.store = new Map();
    }

    set(key, value, ttlSeconds = 7200) {
        const expiresAt = Date.now() + (ttlSeconds * 1000);
        this.store.set(key, { value, expiresAt });
        return true;
    }

    get(key) {
        const item = this.store.get(key);
        if (!item) return null;
        if (Date.now() > item.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return item.value;
    }

    del(key) {
        return this.store.delete(key);
    }

    clear() {
        this.store.clear();
    }
}

let redisClient = null;
let useRedis = false;
const memoryCache = new InMemoryCache();

// Dynamic initialization of redis to avoid hard crashes if client package is missing
async function initRedis() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        logger.info('[REDIS] REDIS_URL not configured. Utilizing in-memory cache client fallback.', 'CACHE');
        return;
    }

    try {
        const { createClient } = await import('redis');
        redisClient = createClient({ url: redisUrl });
        
        redisClient.on('error', (err) => {
            logger.error(`[REDIS ERROR] Connection failed: ${err.message}. Falling back to memory cache.`, 'CACHE');
            useRedis = false;
        });

        await redisClient.connect();
        logger.info('[REDIS] Connected successfully to Redis database cache.', 'CACHE');
        useRedis = true;
    } catch (e) {
        logger.warn(`[REDIS WARNING] Failed to initialize Redis client: ${e.message}. Utilizing in-memory cache.`, 'CACHE');
        useRedis = false;
    }
}

// Kick off initialization
initRedis().catch(err => {
    logger.error(`[REDIS INIT ERROR] ${err.message}`, 'CACHE');
});

export const redisService = {
    /**
     * Retrieves key from cache.
     */
    async get(key) {
        if (useRedis && redisClient) {
            try {
                const val = await redisClient.get(key);
                return val ? JSON.parse(val) : null;
            } catch (err) {
                logger.warn(`[REDIS GET ERROR] ${err.message}. Falling back to memory.`, 'CACHE');
            }
        }
        return memoryCache.get(key);
    },

    /**
     * Stores key-value in cache.
     */
    async set(key, value, ttlSeconds = 7200) {
        if (useRedis && redisClient) {
            try {
                await redisClient.set(key, JSON.stringify(value), {
                    EX: ttlSeconds
                });
                return true;
            } catch (err) {
                logger.warn(`[REDIS SET ERROR] ${err.message}. Falling back to memory.`, 'CACHE');
            }
        }
        return memoryCache.set(key, value, ttlSeconds);
    },

    /**
     * Deletes a key from cache.
     */
    async del(key) {
        if (useRedis && redisClient) {
            try {
                await redisClient.del(key);
                return true;
            } catch (err) {
                logger.warn(`[REDIS DEL ERROR] ${err.message}. Falling back to memory.`, 'CACHE');
            }
        }
        return memoryCache.del(key);
    },

    /**
     * Flushes cache database.
     */
    async flush() {
        if (useRedis && redisClient) {
            try {
                await redisClient.flushAll();
                return true;
            } catch (err) {
                logger.warn(`[REDIS FLUSH ERROR] ${err.message}`, 'CACHE');
            }
        }
        memoryCache.clear();
        return true;
    }
};
