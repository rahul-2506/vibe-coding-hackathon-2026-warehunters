import { supabase } from '../db.js';
import { embeddingService } from './embeddingService.js';
import { rankingService } from './rankingService.js';
import { productService } from './productService.js';
import { logger } from '../utils/logger.js';

function parseSearchIntent(query) {
    const q = (query || '').toLowerCase().trim();
    const intent = {
        category: null,
        subcategory: null,
        brands: [],
        budget: null,
        isGaming: false
    };

    if (q.includes('laptop') || q.includes('computer') || q.includes('macbook')) {
        intent.category = 'Electronics';
        intent.subcategory = 'Laptops';
    }
    if (q.includes('phone') || q.includes('iphone') || q.includes('smartphone')) {
        intent.category = 'Electronics';
        intent.subcategory = 'Smartphones';
    }
    if (q.includes('gaming')) {
        intent.isGaming = true;
    }

    // Extract brands
    const brandsList = ['dell', 'hp', 'lenovo', 'asus', 'acer', 'msi', 'samsung', 'apple', 'oneplus', 'nothing', 'sony', 'cetaphil', 'cerave', 'minimalist', 'himalaya', 'philips', 'dyson', 'logitech'];
    for (const b of brandsList) {
        if (q.includes(b)) {
            let mappedBrand = b.charAt(0).toUpperCase() + b.slice(1);
            if (b === 'oneplus') mappedBrand = 'OnePlus';
            intent.brands.push(mappedBrand);
        }
    }

    // Extract budget constraints
    const underMatch = q.match(/under\s*(\d+)/);
    if (underMatch) {
        intent.budget = Number(underMatch[1]);
    }
    const belowMatch = q.match(/below\s*(\d+)/);
    if (belowMatch) {
        intent.budget = Number(belowMatch[1]);
    }
    const lessThanMatch = q.match(/less\s*than\s*(\d+)/);
    if (lessThanMatch) {
        intent.budget = Number(lessThanMatch[1]);
    }

    return intent;
}

export const vectorSearchService = {
    /**
     * Upgraded 7-Stage Semantic Search Pipeline:
     * 1. Query Normalization
     * 2. Intent Parsing (Brand, Budget, Features)
     * 3. Category Resolution (Skincare or Electronics only)
     * 4. Dual Retrieval (Vector Search & Keyword Search)
     * 5. Reciprocal Rank Fusion (RRF) Merge
     * 6. Metadata Filtering & Details Expansion
     * 7. Preference Ranking & Output Generation
     */
    async semanticSearch(query, category = null, budget = null, limit = 12, userPreferences = null, keys = {}) {
        logger.info(`[Vector Search] Executing semantic search pipeline for: "${query}"`, 'SEARCH_PIPELINE');

        // Stage 1: Query input and normalization
        const cleanQuery = (query || '').trim();

        // Stage 2: Intent detection
        const parsedIntent = parseSearchIntent(cleanQuery);
        const finalBudget = budget || parsedIntent.budget;

        // Stage 3: Category detection (Strictly map to Skincare or Electronics, rejecting others)
        let resolvedCategory = category || parsedIntent.category;
        if (!resolvedCategory || resolvedCategory === 'All') {
            const q = cleanQuery.toLowerCase();
            if (q.match(/serum|cream|moisturizer|cleanser|facewash|toner|sunscreen|skin|ingredients|wrinkle|acne|dryness|oily|sensit/)) {
                resolvedCategory = 'Skincare';
            } else if (q.match(/laptop|phone|earbud|headphone|mouse|keyboard|monitor|gpu|cpu|ram|rtx|intel|apple|samsung|electronics|ssd|console/)) {
                resolvedCategory = 'Electronics';
            }
        }
        
        // Normalize naming
        if (resolvedCategory === 'Skincare & Beauty') {
            resolvedCategory = 'Skincare';
        }

        const rankingContext = {
            query: cleanQuery,
            budget: finalBudget,
            category: resolvedCategory,
            subcategory: parsedIntent.subcategory,
            brands: parsedIntent.brands,
            isGaming: parsedIntent.isGaming,
            ...userPreferences
        };

        // If query is empty, return default products matching resolved category
        if (!cleanQuery) {
            const products = await productService.getAllProducts();
            const filtered = resolvedCategory && resolvedCategory !== 'All'
                ? products.filter(p => p.category.toLowerCase() === resolvedCategory.toLowerCase())
                : products;
            
            const relevanceMap = new Map();
            filtered.forEach(p => relevanceMap.set(String(p.id), 0.5));
            return rankingService.rankProducts(filtered.slice(0, limit), relevanceMap, rankingContext);
        }

        let vectorResults = [];
        let keywordResults = [];

        // Stage 4: Dual Retrieval (Vector Search)
        try {
            logger.info(`[Vector Search] Generating query embedding...`);
            const queryEmbedding = await embeddingService.generateEmbedding(cleanQuery, keys.geminiKey, keys.openaiKey);
            
            logger.info(`[Vector Search] Querying match_products RPC...`);
            const { data, error } = await supabase.rpc('match_products', {
                query_embedding: queryEmbedding,
                match_threshold: 0.1,
                match_count: limit * 3,
                category_filter: (resolvedCategory && resolvedCategory !== 'All') ? resolvedCategory : null
            });

            if (error) {
                logger.warn(`[Vector Search] RPC match_products failed: ${error.message}. Retrying without category_filter...`);
                // Fallback to RPC without category filter
                const { data: fallbackData, error: fallbackError } = await supabase.rpc('match_products', {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.1,
                    match_count: limit * 3
                });

                if (fallbackError) throw fallbackError;
                vectorResults = fallbackData || [];
            } else {
                vectorResults = data || [];
            }
        } catch (err) {
            logger.error(`[Vector Search ERROR] Vector matching failed: ${err.message}`, 'SEARCH_PIPELINE');
            vectorResults = [];
        }

        // Stage 4: Dual Retrieval (Keyword Search in parallel)
        try {
            keywordResults = await productService.searchProducts(cleanQuery, resolvedCategory, null, parsedIntent.subcategory);
        } catch (err) {
            logger.error(`[Vector Search ERROR] Keyword matching failed: ${err.message}`, 'SEARCH_PIPELINE');
            keywordResults = [];
        }

        // Stage 5: Reciprocal Rank Fusion (RRF) Merge
        const RRF_K = 60;
        const rrfScores = new Map();
        
        vectorResults.forEach((doc, idx) => {
            const docId = String(doc.id);
            const rank = idx + 1;
            const score = 1 / (RRF_K + rank);
            rrfScores.set(docId, (rrfScores.get(docId) || 0) + score);
        });

        keywordResults.forEach((doc, idx) => {
            const docId = String(doc.id);
            const rank = idx + 1;
            const score = 1 / (RRF_K + rank);
            rrfScores.set(docId, (rrfScores.get(docId) || 0) + score);
        });

        // Merge product candidates
        const mergedCandidatesMap = new Map();
        vectorResults.forEach(p => mergedCandidatesMap.set(String(p.id), p));
        keywordResults.forEach(p => {
            const idStr = String(p.id);
            if (!mergedCandidatesMap.has(idStr)) {
                mergedCandidatesMap.set(idStr, p);
            }
        });

        const sortedRrfKeys = Array.from(rrfScores.keys())
            .sort((a, b) => rrfScores.get(b) - rrfScores.get(a));

        if (sortedRrfKeys.length === 0) {
            logger.info(`[Vector Search] No products found via dual retrieval.`, 'SEARCH_PIPELINE');
            return [];
        }

        const validDbIds = sortedRrfKeys
            .map(idStr => Number(idStr))
            .filter(id => !isNaN(id) && Number.isInteger(id));

        // Stage 6: Metadata Filtering & Details Expansion
        let finalProducts = [];
        try {
            let fullProducts = [];
            if (validDbIds.length > 0) {
                const { data, error: fetchErr } = await supabase
                    .from('products')
                    .select('*, skincare_details(*), electronics_details(*)')
                    .in('id', validDbIds);

                if (fetchErr) throw fetchErr;
                fullProducts = data || [];
            }

            // Flatten joined details and apply strict filters
            const dbProductsMapped = fullProducts.map(r => {
                const skincare = r.skincare_details ? (Array.isArray(r.skincare_details) ? r.skincare_details[0] : r.skincare_details) : null;
                const electronics = r.electronics_details ? (Array.isArray(r.electronics_details) ? r.electronics_details[0] : r.electronics_details) : null;

                return {
                    ...r,
                    id: Number(r.id),
                    name: r.title || r.name,
                    thumbnail: r.thumbnail || r.image_url,
                    image_url: r.image_url || r.thumbnail,
                    review_count: r.review_count || r.reviews_count || 0,
                    // Flattened details
                    ingredients: skincare?.ingredients || '',
                    key_ingredients: skincare?.key_ingredients || '',
                    skin_type: skincare?.skin_type || '',
                    concerns: skincare?.concerns || '',
                    specifications_json: electronics?.specifications_json || {},
                    technical_features: electronics?.technical_features || ''
                };
            });

            // Now, we need to merge the fetched DB products and any aggregator/non-DB products.
            const finalMergedList = [];
            const dbProductIdsSet = new Set(dbProductsMapped.map(p => p.id));

            for (const idStr of sortedRrfKeys) {
                const dbId = Number(idStr);
                if (!isNaN(dbId) && Number.isInteger(dbId) && dbProductIdsSet.has(dbId)) {
                    const dbProd = dbProductsMapped.find(p => p.id === dbId);
                    if (dbProd) finalMergedList.push(dbProd);
                } else {
                    const rawProd = mergedCandidatesMap.get(idStr);
                    if (rawProd) {
                        const ratingVal = Number(rawProd.rating || 0);
                        const trustScoreVal = Number(rawProd.trust_score || rawProd.trustScore || 80);
                        const reviewCountVal = Number(rawProd.review_count || rawProd.reviewCount || rawProd.reviews_count || 0);
                        const priceVal = Number(rawProd.price_inr || rawProd.price || 0);
                        const originalPriceVal = Number(rawProd.price_original || rawProd.originalPrice || rawProd.original_price || priceVal);

                        finalMergedList.push({
                            ...rawProd,
                            id: isNaN(dbId) ? idStr : dbId,
                            name: rawProd.title || rawProd.name || '',
                            title: rawProd.title || rawProd.name || '',
                            description: rawProd.description || '',
                            category: rawProd.category || 'Others',
                            price: priceVal,
                            price_inr: priceVal,
                            original_price: originalPriceVal,
                            price_original: originalPriceVal,
                            currency: rawProd.currency || 'INR',
                            rating: ratingVal,
                            brand: rawProd.brand || 'Generic',
                            stock: Number(rawProd.stock || 50),
                            thumbnail: rawProd.image || rawProd.thumbnail || rawProd.image_url || '',
                            image_url: rawProd.image_url || rawProd.image || rawProd.thumbnail || '',
                            images: Array.isArray(rawProd.images) ? rawProd.images : [rawProd.image || rawProd.thumbnail || rawProd.image_url || ''],
                            trust_score: trustScoreVal,
                            review_count: reviewCountVal,
                            keywords: Array.isArray(rawProd.keywords) ? rawProd.keywords : [],
                            source: rawProd.source || 'Scraped',
                            product_url: rawProd.productUrl || rawProd.product_url || '',
                            ingredients: rawProd.ingredients || '',
                            key_ingredients: rawProd.key_ingredients || '',
                            skin_type: rawProd.skin_type || '',
                            concerns: rawProd.concerns || '',
                            specifications_json: rawProd.specifications_json || rawProd.specifications || {},
                            technical_features: rawProd.technical_features || ''
                        });
                    }
                }
            }

            finalProducts = finalMergedList;

            // Metadata Filters: Category constraint
            if (resolvedCategory && resolvedCategory !== 'All') {
                finalProducts = finalProducts.filter(p => p.category?.toLowerCase() === resolvedCategory.toLowerCase());
            } else {
                // Ensure only allowed categories are ever returned
                finalProducts = finalProducts.filter(p => p.category === 'Skincare' || p.category === 'Electronics');
            }

            // Metadata Filters: Budget constraint
            if (finalBudget) {
                finalProducts = finalProducts.filter(p => p.price <= finalBudget);
            }

            // Metadata Filters: Brand constraints
            if (parsedIntent.brands.length > 0) {
                finalProducts = finalProducts.filter(p => 
                    parsedIntent.brands.some(b => p.brand?.toLowerCase() === b.toLowerCase())
                );
            }
        } catch (err) {
            logger.error(`[Vector Search ERROR] Details fetch and filtering failed: ${err.message}`, 'SEARCH_PIPELINE');
            return [];
        }

        // Sort final products in the order of their RRF rank using string IDs
        const orderMap = new Map();
        sortedRrfKeys.forEach((idStr, index) => orderMap.set(idStr, index));
        finalProducts.sort((a, b) => orderMap.get(String(a.id)) - orderMap.get(String(b.id)));

        // Create relevance similarity map based on RRF scores for rankingService
        const relevanceMap = new Map();
        finalProducts.forEach(p => {
            const rrfVal = rrfScores.get(String(p.id)) || 0;
            relevanceMap.set(String(p.id), Math.min(1.0, rrfVal * 30)); 
        });

        // Stage 7: Preference ranking & output generation
        logger.info(`[Vector Search] Delegating ${finalProducts.length} filtered products to rankingService...`);
        return rankingService.rankProducts(finalProducts.slice(0, limit), relevanceMap, rankingContext);
    }
};
