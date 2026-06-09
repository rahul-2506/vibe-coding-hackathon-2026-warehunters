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
    async semanticSearch(query, category = null, budget = null, limit = 12, userPreferences = null) {
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
            const queryEmbedding = await embeddingService.generateEmbedding(cleanQuery);
            
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

        const mergedProductIds = Array.from(rrfScores.keys())
            .sort((a, b) => rrfScores.get(b) - rrfScores.get(a))
            .map(idStr => Number(idStr));

        if (mergedProductIds.length === 0) {
            logger.info(`[Vector Search] No products found via dual retrieval.`, 'SEARCH_PIPELINE');
            return [];
        }

        // Stage 6: Metadata Filtering & Details Expansion
        let finalProducts = [];
        try {
            const { data: fullProducts, error: fetchErr } = await supabase
                .from('products')
                .select('*, skincare_details(*), electronics_details(*)')
                .in('id', mergedProductIds);

            if (fetchErr) throw fetchErr;

            // Flatten joined details and apply strict filters
            finalProducts = fullProducts.map(r => {
                const skincare = r.skincare_details ? (Array.isArray(r.skincare_details) ? r.skincare_details[0] : r.skincare_details) : null;
                const electronics = r.electronics_details ? (Array.isArray(r.electronics_details) ? r.electronics_details[0] : r.electronics_details) : null;

                return {
                    ...r,
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

        // Sort final products in the order of their RRF rank
        const orderMap = new Map();
        mergedProductIds.forEach((id, index) => orderMap.set(id, index));
        finalProducts.sort((a, b) => orderMap.get(a.id) - orderMap.get(b.id));

        // Create relevance similarity map based on RRF scores for rankingService
        const relevanceMap = new Map();
        finalProducts.forEach(p => {
            // Normalize RRF score to a 0.0 - 1.0 range
            const rrfVal = rrfScores.get(String(p.id)) || 0;
            relevanceMap.set(String(p.id), Math.min(1.0, rrfVal * 30)); 
        });

        // Stage 7: Preference ranking & output generation
        logger.info(`[Vector Search] Delegating ${finalProducts.length} filtered products to rankingService...`);
        return rankingService.rankProducts(finalProducts.slice(0, limit), relevanceMap, rankingContext);
    }
};
