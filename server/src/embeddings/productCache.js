import { supabase } from '../../db.js';
import { embeddingService } from '../../services/embeddingService.js';
import { logger } from '../../utils/logger.js';

export const productCache = {
    /**
     * Caches a product and its reviews in the PostgreSQL database.
     * Generates its embedding automatically.
     */
    async cacheProduct(product, reviews = [], keys = {}) {
        logger.info(`[PRODUCT CACHE] Caching product: "${product.title || product.name}"`, 'AI_CACHE');

        try {
            // 1. Prepare fields for products table
            const pTitle = product.title || product.name || 'Skincare Product';
            const priceVal = Number(product.price || 15);
            const ratingVal = Number(product.rating || 4.2);
            const trustVal = Number(product.trust_score || 80);

            const record = {
                title: pTitle,
                name: pTitle,
                description: product.description || '',
                explanation: product.explanation || product.description || '',
                category: product.category || 'Skincare & Beauty',
                price: priceVal,
                rating: ratingVal,
                brand: product.brand || 'Generic',
                thumbnail: product.thumbnail || product.image_url || '',
                image_url: product.image_url || product.thumbnail || '',
                trust_score: trustVal,
                reviews_count: reviews.length || product.reviews_count || 0,
                keywords: product.keywords || []
            };

            // Generate Embedding
            try {
                const embeddingText = `${pTitle} ${record.brand} ${record.category} ${record.description}`.trim();
                record.embedding = await embeddingService.generateEmbedding(embeddingText, keys.geminiKey, keys.openaiKey);
            } catch (embErr) {
                logger.warn(`[PRODUCT CACHE] Embedding generation failed: ${embErr.message}`, 'AI_CACHE');
            }

            // Upsert in database
            // If the product exists (match by title and brand), we update, otherwise insert
            let productId = null;
            
            // Check if product already exists by title
            const { data: existing, error: checkError } = await supabase
                .from('products')
                .select('id')
                .eq('title', pTitle)
                .limit(1);

            if (!checkError && existing && existing.length > 0) {
                productId = existing[0].id;
                const { error: updateError } = await supabase
                    .from('products')
                    .update(record)
                    .eq('id', productId);
                if (updateError) throw updateError;
                logger.info(`[PRODUCT CACHE] Updated product ID: ${productId}`, 'AI_CACHE');
            } else {
                const { data: inserted, error: insertError } = await supabase
                    .from('products')
                    .insert(record)
                    .select('id')
                    .single();
                if (insertError) throw insertError;
                productId = inserted.id;
                logger.info(`[PRODUCT CACHE] Inserted new product ID: ${productId}`, 'AI_CACHE');
            }

            // 2. Cache reviews
            if (reviews && reviews.length > 0 && productId) {
                const reviewRecords = reviews.map(r => ({
                    product_id: productId,
                    rating: Number(r.rating || 5),
                    review_text: r.review_text || r.text || '',
                    sentiment: r.sentiment || 'neutral',
                    verdict: r.verdict || 'Genuine',
                    trust_score: Number(r.trust_score || 90),
                    source: r.source || 'External API',
                    product_name: pTitle
                }));

                const { error: reviewsErr } = await supabase
                    .from('reviews')
                    .insert(reviewRecords);

                if (reviewsErr) {
                    logger.warn(`[PRODUCT CACHE] Failed to cache reviews: ${reviewsErr.message}`, 'AI_CACHE');
                } else {
                    logger.info(`[PRODUCT CACHE] Cached ${reviews.length} reviews for product ID: ${productId}`, 'AI_CACHE');
                }
            }

            return productId;
        } catch (err) {
            logger.error(`[PRODUCT CACHE] Error caching product: ${err.message}`, 'AI_CACHE');
            return null;
        }
    }
};
