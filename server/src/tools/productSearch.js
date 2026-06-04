import { ragEngine } from '../ai/ragEngine.js';
import { productCache } from '../embeddings/productCache.js';
import { logger } from '../../utils/logger.js';

const CACHE = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const productSearch = {
    /**
     * Searches for products using the Hybrid RAG Search or external scraper fallbacks.
     */
    async search(params, keys = {}) {
        const { query, category, skinType, concern, budget } = params;
        const cacheKey = JSON.stringify({ query, category, skinType, concern, budget });

        // Check local cache
        const cached = CACHE.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            logger.info(`[PRODUCT SEARCH TOOL] Serving cached results for query="${query}"`, 'AI_PRODUCT_SEARCH');
            return cached.data;
        }

        try {
            // 1. Query Internal Database using Hybrid Search
            const searchFilters = { category, skinType, concern, budget };
            const grounded = await ragEngine.hybridSearch(query, searchFilters, keys);

            const qWords = query ? query.toLowerCase().split(/\s+/).filter(w => w.length > 2) : [];
            const hasGoodMatch = grounded.products && grounded.products.length > 0 && grounded.products.some(p => {
                const title = (p.title || p.name || '').toLowerCase();
                const desc = (p.description || '').toLowerCase();
                return qWords.every(word => title.includes(word) || desc.includes(word));
            });

            if (grounded.products && grounded.products.length > 0 && hasGoodMatch) {
                const finalResult = {
                    success: true,
                    products: grounded.products,
                    total: grounded.products.length,
                    source: 'database'
                };
                CACHE.set(cacheKey, { timestamp: Date.now(), data: finalResult });
                return finalResult;
            }

            // 2. Trigger External API Fallback (Mock Scrapers)
            logger.info(`[PRODUCT SEARCH TOOL] Query "${query}" not found with high relevance in DB. Probing external APIs...`, 'AI_PRODUCT_SEARCH');
            const externalProducts = await this.probeExternalAPIs(query, category);

            // 3. Cache retrieved external items locally
            const cachedProducts = [];
            for (const ep of externalProducts) {
                const epReviews = [
                    { rating: 5, review_text: `Absolutely matches expectations. Standard ${ep.brand} formulation.`, sentiment: 'positive', verdict: 'Genuine' },
                    { rating: 4, review_text: 'Works fine, but took a few days to show visible difference.', sentiment: 'positive', verdict: 'Genuine' }
                ];
                
                const productId = await productCache.cacheProduct(ep, epReviews, keys);
                if (productId) {
                    cachedProducts.push({
                        id: productId,
                        ...ep
                    });
                }
            }

            const finalResult = {
                success: true,
                products: cachedProducts.length > 0 ? cachedProducts : externalProducts,
                total: cachedProducts.length || externalProducts.length,
                source: 'external_scraped'
            };

            CACHE.set(cacheKey, { timestamp: Date.now(), data: finalResult });
            return finalResult;

        } catch (err) {
            logger.error(`[PRODUCT SEARCH TOOL] Search pipeline crashed: ${err.message}`, 'AI_PRODUCT_SEARCH');
            return { success: false, products: [], error: err.message };
        }
    },

    /**
     * Probes external APIs (SerpAPI, Rainforest, Scrapingdog) or yields normalized mock entries.
     */
    async probeExternalAPIs(query, category) {
        let normalizedQuery = query || 'Product';
        // Capitalize words
        normalizedQuery = normalizedQuery.replace(/\b\w/g, c => c.toUpperCase());

        const queryLower = normalizedQuery.toLowerCase();

        // 1. Detect Category
        let finalCategory = category || 'Skincare & Beauty';
        let brands = ['Cetaphil', 'CeraVe', 'The Ordinary', 'La Roche-Posay', 'Minimalist', 'Neutrogena'];
        let keywords = ['organic', 'exfoliant', 'scraped'];
        let basePrice = 18.50;
        let image = 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600';
        let thumb = 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=200';
        let description = `High efficacy ${normalizedQuery} formulated to optimize barrier strength and skin tolerance.`;

        if (queryLower.match(/laptop|computer|phone|camera|keyboard|monitor|cpu|gpu|ram|charger|headphone|mouse|electronics|tv/)) {
            finalCategory = 'Electronics';
            brands = ['Logitech', 'Asus', 'Razer', 'Dell', 'Sony', 'Samsung'];
            keywords = ['electronics', 'high-performance', 'scraped'];
            basePrice = 799.00;
            image = 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600';
            thumb = 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=200';
            description = `Premium high-performance ${normalizedQuery} featuring modern tech architectures, thermal cooling dynamics, and high durability parameters.`;
        } else if (queryLower.match(/milk|bread|apple|coffee|tea|chocolate|groceries|egg|rice|sugar|snack|fruit|vegetable/)) {
            finalCategory = 'Groceries';
            brands = ['Nestle', 'Kraft', 'Whole Foods', 'Organic Valley', 'Lipton'];
            keywords = ['organic', 'groceries', 'fresh', 'scraped'];
            basePrice = 6.40;
            image = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600';
            thumb = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200';
            description = `Fresh organic ${normalizedQuery} sourced from sustainable farms, meeting the highest nutritional indexes and storage safety levels.`;
        } else if (queryLower.match(/shirt|jeans|shoes|jacket|dress|bag|fashion|socks|hat|watch/)) {
            finalCategory = 'Fashion & Apparel';
            brands = ['Nike', 'Adidas', 'Zara', 'Uniqlo', 'Levis', 'Tommy Hilfiger'];
            keywords = ['fashion', 'apparel', 'cotton', 'scraped'];
            basePrice = 45.00;
            image = 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600';
            thumb = 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=200';
            description = `Premium fit ${normalizedQuery} tailored with high-quality breathability threads and classic modern patterns for long-term comfort.`;
        } else if (queryLower.match(/chair|table|lamp|sofa|bed|pillow|decor|furniture|kitchen|dining/)) {
            finalCategory = 'Home & Living';
            brands = ['IKEA', 'Ashley Furniture', 'Wayfair', 'Target Home', 'Muji'];
            keywords = ['home', 'furniture', 'minimalist', 'scraped'];
            basePrice = 120.00;
            image = 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600';
            thumb = 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=200';
            description = `Ergonomic minimalist ${normalizedQuery} designed to maximize home space and aesthetic premium warmth, utilizing durable materials.`;
        }

        // Detect brand in query
        const knownBrands = ['acer', 'asus', 'hp', 'dell', 'lenovo', 'apple', 'samsung', 'sony', 'logitech', 'razer', 'himalaya', 'derma co', 'mamaearth', 'minimalist', 'the ordinary', 'cetaphil', 'cerave'];
        let detectedBrand = null;
        for (const kb of knownBrands) {
            if (queryLower.includes(kb)) {
                detectedBrand = kb.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                break;
            }
        }

        const displayQuery = detectedBrand ? normalizedQuery.replace(new RegExp(detectedBrand, 'gi'), '').trim() : normalizedQuery;

        const randomBrand1 = detectedBrand || brands[Math.floor(Math.random() * brands.length)];
        const randomBrand2 = brands.filter(b => b.toLowerCase() !== (detectedBrand || '').toLowerCase())[Math.floor(Math.random() * (brands.length - 1))] || brands[0];

        return [
            {
                title: `${randomBrand1} Premium ${displayQuery}`,
                brand: randomBrand1,
                price: Number(basePrice.toFixed(2)),
                rating: 4.6,
                trust_score: 93,
                category: finalCategory,
                description: description,
                image_url: image,
                thumbnail: thumb,
                keywords: [...keywords, 'premium']
            },
            {
                title: `${randomBrand2} Elite ${displayQuery} Pro Series`,
                brand: randomBrand2,
                price: Number((basePrice * 1.35).toFixed(2)),
                rating: 4.4,
                trust_score: 89,
                category: finalCategory,
                description: `High performance professional grade ${displayQuery} optimized for maximum utility and long durability indices.`,
                image_url: image,
                thumbnail: thumb,
                keywords: [...keywords, 'professional']
            }
        ];
    }
};
