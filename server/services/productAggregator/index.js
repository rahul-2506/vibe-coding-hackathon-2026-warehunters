import { AmazonProvider } from './AmazonProvider.js';
import { FlipkartProvider } from './FlipkartProvider.js';
import { MyntraProvider } from './MyntraProvider.js';
import { NykaaProvider } from './NykaaProvider.js';
import { AjioProvider } from './AjioProvider.js';
import { CromaProvider } from './CromaProvider.js';
import { RelianceDigitalProvider } from './RelianceDigitalProvider.js';
import { InternalDbProvider } from './InternalDbProvider.js';
import { logger } from '../../utils/logger.js';
import { supabase } from '../../db.js';
import { redisService } from '../redisService.js';

class ProductAggregator {
    constructor() {
        this.providers = {
            'Amazon': new AmazonProvider(),
            'Flipkart': new FlipkartProvider(),
            'Myntra': new MyntraProvider(),
            'Nykaa': new NykaaProvider(),
            'Ajio': new AjioProvider(),
            'Croma': new CromaProvider(),
            'Reliance Digital': new RelianceDigitalProvider(),
            'Internal Database': new InternalDbProvider()
        };
    }

    /**
     * Searches all providers in parallel with multi-tier caching.
     * @param {string} query 
     * @param {string} [category] 
     * @returns {Promise<Array>} Unified, normalized product results.
     */
    async searchProducts(query, category) {
        if (!query) return [];
        const cleanQuery = query.toLowerCase().trim();
        const cacheKey = `agg_search:${cleanQuery}:${category || 'all'}`;

        // 1. Try Cache Tier 1 (Redis / In-memory)
        try {
            const cachedValue = await redisService.get(cacheKey);
            if (cachedValue) {
                logger.info(`[AGGREGATOR] Tier 1 Cache Hit (Redis/Memory) for "${query}"`, 'PRODUCT_AGGREGATOR');
                return cachedValue;
            }
        } catch (cacheErr) {
            logger.warn(`[AGGREGATOR CACHE WARNING] Tier 1 cache get failed: ${cacheErr.message}`, 'PRODUCT_AGGREGATOR');
        }

        // 2. Try Cache Tier 2 (Supabase search_cache Table)
        try {
            const { data, error } = await supabase
                .from('search_cache')
                .select('results, expires_at')
                .eq('query', cacheKey)
                .single();

            if (!error && data && new Date(data.expires_at) > new Date()) {
                logger.info(`[AGGREGATOR] Tier 2 Cache Hit (Supabase DB) for "${query}"`, 'PRODUCT_AGGREGATOR');
                // Store back into fast Tier 1 cache
                await redisService.set(cacheKey, data.results, 7200);
                return data.results;
            }
        } catch (dbCacheErr) {
            logger.warn(`[AGGREGATOR CACHE WARNING] Tier 2 cache get failed: ${dbCacheErr.message}`, 'PRODUCT_AGGREGATOR');
        }

        logger.info(`[AGGREGATOR] Cache Miss. Executing live parallel search for: "${query}"`, 'PRODUCT_AGGREGATOR');

        
        // Execute search on all providers in parallel
        const searchPromises = Object.entries(this.providers).map(async ([name, provider]) => {
            try {
                const results = await provider.searchProducts(query, category);
                logger.info(`[AGGREGATOR] Provider "${name}" returned ${results.length} results.`, 'PRODUCT_AGGREGATOR');
                return results;
            } catch (err) {
                logger.error(`[AGGREGATOR ERROR] Provider "${name}" failed: ${err.message}`, 'PRODUCT_AGGREGATOR');
                return [];
            }
        });

        const allResultsArray = await Promise.all(searchPromises);
        
        // Flatten array of arrays
        const flattened = allResultsArray.flat();
        
        // Deduplicate results by URL
        const seenUrls = new Set();
        const deduplicated = [];
        for (const item of flattened) {
            if (!item || !item.productUrl) continue;
            if (!seenUrls.has(item.productUrl)) {
                seenUrls.add(item.productUrl);
                deduplicated.push(item);
            }
        }

        // Cache results for 2 hours (7200 seconds)
        try {
            await redisService.set(cacheKey, deduplicated, 7200);
            
            const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
            const { error: upsertErr } = await supabase
                .from('search_cache')
                .upsert({
                    query: cacheKey,
                    results: deduplicated,
                    expires_at: expiresAt
                });
            if (upsertErr) {
                logger.warn(`[AGGREGATOR CACHE WARNING] Supabase search_cache upsert failed: ${upsertErr.message}`, 'PRODUCT_AGGREGATOR');
            }
        } catch (cacheWriteErr) {
            logger.warn(`[AGGREGATOR CACHE WARNING] Writing cache failed: ${cacheWriteErr.message}`, 'PRODUCT_AGGREGATOR');
        }

        return deduplicated;
    }

    /**
     * Retrieve a product from a specific source/provider.
     */
    async getProduct(id, source) {
        const provider = this.providers[source] || this.providers['Internal Database'];
        try {
            return await provider.getProduct(id);
        } catch (err) {
            logger.error(`[AGGREGATOR ERROR] getProduct failed for source "${source}": ${err.message}`, 'PRODUCT_AGGREGATOR');
            return null;
        }
    }

    /**
     * Get recommendations from a specific provider.
     */
    async getRecommendations(productId, source) {
        const provider = this.providers[source] || this.providers['Internal Database'];
        try {
            return await provider.getRecommendations(productId);
        } catch (err) {
            logger.error(`[AGGREGATOR ERROR] getRecommendations failed for source "${source}": ${err.message}`, 'PRODUCT_AGGREGATOR');
            return [];
        }
    }

    /**
     * Get related products from a specific provider.
     */
    async getRelatedProducts(productId, source) {
        const provider = this.providers[source] || this.providers['Internal Database'];
        try {
            return await provider.getRelatedProducts(productId);
        } catch (err) {
            logger.error(`[AGGREGATOR ERROR] getRelatedProducts failed for source "${source}": ${err.message}`, 'PRODUCT_AGGREGATOR');
            return [];
        }
    }
}

export const productAggregator = new ProductAggregator();
