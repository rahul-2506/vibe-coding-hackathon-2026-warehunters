import { supabase } from '../db.js';
import { embeddingService } from './embeddingService.js';
import { rankingService } from './rankingService.js';
import { productService } from './productService.js';

export const vectorSearchService = {
    /**
     * Performs semantic product retrieval using pgvector.
     * Cascades down to text search if no embedding model key is available or if queries fail.
     */
    async semanticSearch(query, category = null, budget = null, limit = 12) {
        if (!query || typeof query !== 'string' || query.trim() === '') {
            // Retrieve default products if query is empty
            const products = await productService.getAllProducts();
            const filtered = category && category !== 'All'
                ? products.filter(p => p.category.toLowerCase() === category.toLowerCase())
                : products;
            
            // Map fake relevance map for ranking
            const relevanceMap = new Map();
            filtered.forEach(p => relevanceMap.set(String(p.id), 0.5));
            return rankingService.rankProducts(filtered.slice(0, limit), relevanceMap, { budget });
        }

        try {
            console.log(`[Vector Search] Generating embedding for query: "${query}"`);
            
            // 1. Generate embedding
            const queryEmbedding = await embeddingService.generateEmbedding(query);
            
            // 2. Query Supabase RPC match_products
            console.log(`[Vector Search] Querying match_products RPC...`);
            const { data: vectorResults, error } = await supabase.rpc('match_products', {
                query_embedding: queryEmbedding,
                match_threshold: 0.1,
                match_count: limit * 2,
                category_filter: (category && category !== 'All' && category !== '') ? category : null
            });

            if (error) {
                console.warn(`[Vector Search Warning] Supabase RPC failed: ${error.message}. Falling back to text search...`);
                throw error;
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
                return rankingService.rankProducts(mappedProducts, relevanceMap, { budget });
            }

            console.log('[Vector Search] Vector search returned 0 matches. Falling back to keyword matching...');

        } catch (err) {
            console.error('[Vector Search Error] Semantic search pipeline failed:', err.message);
        }

        // 3. Fallback to standard text search + ranking
        console.log('[Vector Search Fallback] Executing text search matching...');
        const keywordMatched = await productService.searchProducts(query, category, null);
        
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

        return rankingService.rankProducts(keywordMatched, relevanceMap, { budget });
    }
};
