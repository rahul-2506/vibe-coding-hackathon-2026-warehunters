import { supabase } from '../../db.js';
import { embeddingService } from '../../services/embeddingService.js';
import { logger } from '../../utils/logger.js';

export const productCache = {
    /**
     * Caches a product and its reviews in the PostgreSQL database.
     * Generates its embedding automatically.
     */
    async cacheProduct(product, reviews = [], keys = {}) {
        const pTitle = product.title || product.name || '';
        const brandVal = product.brand || 'Generic';
        let categoryVal = product.category || '';
        if (categoryVal === 'Skincare & Beauty') {
            categoryVal = 'Skincare';
        }

        logger.info(`[PRODUCT CACHE] Caching product: "${pTitle}" (Category: ${categoryVal})`, 'AI_CACHE');

        try {
            // 1. DATA QUALITY LAYER - Validate product fields
            if (!pTitle || pTitle.trim().length < 3 || pTitle.toLowerCase().includes('placeholder') || pTitle.toLowerCase().includes('test product')) {
                throw new Error(`Data quality check failed: invalid or garbage product name "${pTitle}"`);
            }

            if (categoryVal !== 'Skincare' && categoryVal !== 'Electronics') {
                throw new Error(`Data quality check failed: unsupported category "${categoryVal}"`);
            }

            const img = product.thumbnail || product.image_url || '';
            if (!img || (!img.startsWith('http://') && !img.startsWith('https://'))) {
                throw new Error(`Data quality check failed: invalid or missing image URL for "${pTitle}"`);
            }

            const priceInr = Number(product.price_inr || product.price || 0);
            if (priceInr <= 0) {
                throw new Error(`Data quality check failed: invalid price ${priceInr} for "${pTitle}"`);
            }

            const priceOriginal = Number(product.price_original || product.original_price || priceInr);
            const currencyVal = product.currency || 'INR';
            const lastUpdatedVal = product.last_updated || product.last_price_update || new Date().toISOString();
            const ratingVal = Number(product.rating || 4.2);
            const trustVal = Number(product.trust_score || 80);

            // 2. DEDUPLICATION - Search database for duplicate by URL or Normalized Name + Brand
            const normalizeString = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
            const normalizedTitle = normalizeString(pTitle);
            const normalizedBrand = normalizeString(brandVal);
            const productUrlVal = product.product_url || product.productUrl || '';

            let existingProduct = null;

            // Check by product url first if it's set and valid
            if (productUrlVal && productUrlVal.length > 5) {
                const { data, error } = await supabase
                    .from('products')
                    .select('id, title, name, brand, category')
                    .eq('product_url', productUrlVal)
                    .limit(1);
                
                if (!error && data && data.length > 0) {
                    existingProduct = data[0];
                }
            }

            // Fallback: check by title and brand matching
            if (!existingProduct) {
                const { data, error } = await supabase
                    .from('products')
                    .select('id, title, name, brand, category');
                
                if (!error && data) {
                    existingProduct = data.find(p => 
                        normalizeString(p.title || p.name) === normalizedTitle && 
                        normalizeString(p.brand) === normalizedBrand
                    );
                }
            }

            const record = {
                title: pTitle,
                name: pTitle,
                description: product.description || '',
                category: categoryVal,
                price: priceInr, // standard column
                price_inr: priceInr, // refactored schema column
                original_price: priceOriginal, // standard column
                price_original: priceOriginal, // refactored schema column
                currency: currencyVal,
                last_updated: lastUpdatedVal,
                rating: ratingVal,
                brand: brandVal,
                thumbnail: img,
                image_url: img,
                trust_score: trustVal,
                reviews_count: reviews.length || product.reviews_count || 0,
                review_count: reviews.length || product.reviews_count || 0,
                keywords: product.keywords || [],
                product_url: productUrlVal,
                source: product.source || 'Scraped Provider'
            };

            // 3. CATEGORY SPECIFIC DETAILS BUILDER
            let skincareData = null;
            let electronicsData = null;
            let embeddingText = `${pTitle} Brand: ${brandVal} Category: ${categoryVal} Description: ${record.description}`;

            if (categoryVal === 'Skincare') {
                skincareData = {
                    ingredients: product.ingredients || product.skincare_details?.ingredients || '',
                    key_ingredients: product.key_ingredients || product.skincare_details?.key_ingredients || '',
                    skin_type: product.skin_type || product.skincare_details?.skin_type || '',
                    concerns: product.concerns || product.skincare_details?.concerns || ''
                };
                embeddingText += ` Ingredients: ${skincareData.ingredients} Key Ingredients: ${skincareData.key_ingredients} SkinType: ${skincareData.skin_type} Concerns: ${skincareData.concerns}`;
            } else if (categoryVal === 'Electronics') {
                const specObj = product.specifications_json || product.electronics_details?.specifications_json || product.specifications || {};
                const specStr = typeof specObj === 'object' ? JSON.stringify(specObj) : String(specObj);
                electronicsData = {
                    specifications_json: specObj,
                    technical_features: product.technical_features || product.electronics_details?.technical_features || ''
                };
                embeddingText += ` Specifications: ${specStr} Technical Features: ${electronicsData.technical_features}`;
            }

            // 4. GENERATE EMBEDDING (incorporating detail attributes)
            try {
                record.embedding = await embeddingService.generateEmbedding(embeddingText.trim(), keys.geminiKey, keys.openaiKey);
            } catch (embErr) {
                logger.warn(`[PRODUCT CACHE] Embedding generation failed: ${embErr.message}`, 'AI_CACHE');
            }

            // 5. DB WRITE (UPSERT/INSERT)
            let productId = null;
            if (existingProduct) {
                productId = existingProduct.id;
                const { error: updateError } = await supabase
                    .from('products')
                    .update(record)
                    .eq('id', productId);
                
                if (updateError) throw updateError;
                logger.info(`[PRODUCT CACHE] Deduplication hit. Updated product ID: ${productId}`, 'AI_CACHE');
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

            // 6. WRITE CATEGORY DETAILS TO DETAILS TABLES
            if (productId) {
                if (categoryVal === 'Skincare' && skincareData) {
                    skincareData.product_id = productId;
                    const { error: skinErr } = await supabase
                        .from('skincare_details')
                        .upsert(skincareData);
                    
                    if (skinErr) {
                        logger.warn(`[PRODUCT CACHE] Failed to write skincare details: ${skinErr.message}`, 'AI_CACHE');
                    }
                } else if (categoryVal === 'Electronics' && electronicsData) {
                    electronicsData.product_id = productId;
                    const { error: elecErr } = await supabase
                        .from('electronics_details')
                        .upsert(electronicsData);
                    
                    if (elecErr) {
                        logger.warn(`[PRODUCT CACHE] Failed to write electronics details: ${elecErr.message}`, 'AI_CACHE');
                    }
                }
            }

            // 7. WRITE REVIEWS
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
