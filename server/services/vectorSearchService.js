import { supabase } from '../db.js';
import { embeddingService } from './embeddingService.js';
import { rankingService } from './rankingService.js';
import { productService } from './productService.js';

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
    const brandsList = ['dell', 'hp', 'lenovo', 'asus', 'acer', 'msi', 'samsung', 'apple', 'oneplus', 'nothing', 'sony', 'cetaphil', 'cerave', 'minimalist', 'himalaya', 'nescafe', 'tata', 'oreo', 'amul', 'philips', 'dyson', 'ikea', 'nike', 'adidas', 'levis', 'uniqlo'];
    for (const b of brandsList) {
        if (q.includes(b)) {
            let mappedBrand = b.charAt(0).toUpperCase() + b.slice(1);
            if (b === 'oneplus') mappedBrand = 'OnePlus';
            if (b === 'levis') mappedBrand = "Levi's";
            if (b === 'ikea') mappedBrand = 'IKEA';
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
     * Performs semantic product retrieval using pgvector.
     * Cascades down to text search if no embedding model key is available or if queries fail.
     */
    async semanticSearch(query, category = null, budget = null, limit = 12, userPreferences = null) {
        const parsedIntent = parseSearchIntent(query);
        const finalCategory = category || parsedIntent.category;
        const finalBudget = budget || parsedIntent.budget;

        const rankingContext = {
            query,
            budget: finalBudget,
            category: finalCategory,
            subcategory: parsedIntent.subcategory,
            brands: parsedIntent.brands,
            isGaming: parsedIntent.isGaming,
            ...userPreferences
        };

        if (!query || typeof query !== 'string' || query.trim() === '') {
            // Retrieve default products if query is empty
            const products = await productService.getAllProducts();
            const filtered = finalCategory && finalCategory !== 'All'
                ? products.filter(p => p.category.toLowerCase() === finalCategory.toLowerCase())
                : products;
            
            // Map relevance map for ranking
            const relevanceMap = new Map();
            filtered.forEach(p => relevanceMap.set(String(p.id), 0.5));
            return rankingService.rankProducts(filtered.slice(0, limit), relevanceMap, rankingContext);
        }

        try {
            console.log(`[Vector Search] Generating embedding for query: "${query}"`);
            
            // 1. Generate embedding
            const queryEmbedding = await embeddingService.generateEmbedding(query);
            
            // 2. Query Supabase RPC match_products with fallback for signatures
            console.log(`[Vector Search] Querying match_products RPC (attempting 4-parameter signature)...`);
            let vectorResults = null;
            let error = null;

            try {
                const response = await supabase.rpc('match_products', {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.1,
                    match_count: limit * 2,
                    category_filter: (finalCategory && finalCategory !== 'All' && finalCategory !== '') ? finalCategory : null
                });
                vectorResults = response.data;
                error = response.error;
            } catch (rpcErr) {
                console.warn(`[Vector Search] 4-parameter RPC failed with exception: ${rpcErr.message}. Retrying with 3-parameter signature...`);
                error = rpcErr;
            }

            // Fallback to 3-parameter signature if 4-parameter signature is missing in database schema cache
            if (error && (error.code === 'PGRST202' || error.message?.includes('Could not find') || error.message?.includes('schema cache'))) {
                console.log(`[Vector Search] Re-attempting query with 3-parameter signature (excluding category_filter)...`);
                try {
                    const response = await supabase.rpc('match_products', {
                        query_embedding: queryEmbedding,
                        match_threshold: 0.1,
                        match_count: limit * 2
                    });
                    
                    vectorResults = response.data;
                    error = response.error;

                    // Manually filter by category in memory since pgvector couldn't filter in DB
                    if (vectorResults && finalCategory && finalCategory !== 'All' && finalCategory !== '') {
                        console.log(`[Vector Search] Performing in-memory category filtering for "${finalCategory}"...`);
                        vectorResults = vectorResults.filter(p => p.category?.toLowerCase() === finalCategory.toLowerCase());
                    }
                } catch (fallbackErr) {
                    error = fallbackErr;
                }
            }

            if (error) {
                console.error(`[Vector Search ERROR] Supabase RPC failed: ${error.code || 'EXCEPTION'} - ${error.message}. Falling back to text search...`);
                throw new Error(error.message || 'Vector search RPC failed');
            }

            if (vectorResults && vectorResults.length > 0) {
                console.log(`[Vector Search] Vector search returned ${vectorResults.length} matches.`);
                
                // Map similarities into a relevance map
                const relevanceMap = new Map();
                const productIds = vectorResults.map(p => {
                    relevanceMap.set(String(p.id), p.similarity);
                    return p.id;
                });

                // Fetch full products info including features
                const { data: fullProducts, error: fetchErr } = await supabase
                    .from('products')
                    .select('*')
                    .in('id', productIds);
                
                if (fetchErr) throw fetchErr;

                // Sync formats and resolve fields for frontend compatibility
                const mappedProducts = fullProducts.map(p => {
                    const sim = relevanceMap.get(String(p.id)) || 0.5;
                    return {
                        ...p,
                        name: p.title || p.name,
                        thumbnail: p.thumbnail || p.image_url,
                        image_url: p.image_url || p.thumbnail,
                        review_count: p.review_count || p.reviews_count || 0
                    };
                });

                // Rank the matching items
                return rankingService.rankProducts(mappedProducts, relevanceMap, rankingContext);
            }

            console.log('[Vector Search] Vector search returned 0 matches. Falling back to keyword matching...');

        } catch (err) {
            console.error('[Vector Search Error] Semantic search pipeline failed:', err.message);
        }

        // 3. Fallback to standard text search + ranking
        console.log('[Vector Search Fallback] Executing text search matching...');
        const keywordMatched = await productService.searchProducts(query, finalCategory, null, parsedIntent.subcategory);
        
        // Compute basic string distance/relevance score for ranking
        const relevanceMap = new Map();
        const qLower = query.toLowerCase();
        
        keywordMatched.forEach(p => {
            const title = (p.title || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            
            let matchScore = 0.3; // base similarity
            if (title.includes(qLower)) matchScore += 0.5;
            else if (desc.includes(qLower)) matchScore += 0.2;
            
            relevanceMap.set(String(p.id), Math.min(1.0, matchScore));
        });

        return rankingService.rankProducts(keywordMatched, relevanceMap, rankingContext);
    }
};
