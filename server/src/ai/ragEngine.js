import { vectorStore } from '../embeddings/vectorStore.js';
import { embeddingService } from '../../services/embeddingService.js';
import { supabase } from '../../db.js';
import { logger } from '../../utils/logger.js';

export const ragEngine = {
    /**
     * Performs a Hybrid Search (Keyword FTS + Vector Similarity + Reranking) across products and knowledge.
     * @param {string} query - User search query
     * @param {Object} filters - Search filters (category, budget, skinType, concern)
     * @returns {Object} Grounded context: { knowledgeSnippets: [], products: [], reviews: [] }
     */
    async hybridSearch(query, filters = {}, keys = {}) {
        logger.info(`[RAG HYBRID] Starting hybrid search for: "${query}"`, 'AI_RAG');

        const { category = null, budget = null, skinType = null, concern = null } = filters;

        // 1. Generate Query Embedding
        let queryEmbedding = null;
        try {
            queryEmbedding = await embeddingService.generateEmbedding(query, keys.geminiKey, keys.openaiKey);
        } catch (err) {
            logger.warn(`[RAG HYBRID] Embedding generation failed: ${err.message}. Using keyword-only pipeline.`, 'AI_RAG');
        }

        // 2. RUN PARALLEL RETRIEVALS
        const vectorResultsPromise = queryEmbedding
            ? vectorStore.matchProducts(queryEmbedding, category, 15)
            : Promise.resolve([]);

        const keywordResultsPromise = this.keywordSearch(query, category);

        const [vectorMatches, keywordMatches] = await Promise.all([
            vectorResultsPromise,
            keywordResultsPromise
        ]);

        // 3. RECIPROCAL RANK FUSION (RRF) & SCORE MERGING
        const mergedProducts = this.mergeAndScore(vectorMatches, keywordMatches, budget);

        // 4. RERANKER
        const rerankedProducts = this.rerankProducts(mergedProducts, query, filters);

        // 5. KNOWLEDGE RETRIEVAL (Hybrid matching)
        const kbSnippets = await this.retrieveKnowledge(query, queryEmbedding, keys);

        // 6. VERIFIED REVIEWS RETRIEVAL
        const reviews = await this.retrieveReviews(rerankedProducts.slice(0, 3));

        logger.info(`[RAG HYBRID] Found ${kbSnippets.length} KB snippets, ${rerankedProducts.length} products, ${reviews.length} reviews.`, 'AI_RAG');

        return {
            knowledgeSnippets: kbSnippets,
            products: rerankedProducts.slice(0, 5), // Return top 5 reranked products
            reviews
        };
    },

    /**
     * Local SQL keyword search.
     */
    async keywordSearch(query, category) {
        if (!query) return [];

        try {
            const cleanQuery = query.toLowerCase().trim();
            let queryBuilder = supabase.from('products').select('*');

            if (category && category !== 'All') {
                queryBuilder = queryBuilder.eq('category', category);
            }

            // Simple text search on title, brand, description, and keywords
            const { data, error } = await queryBuilder;
            if (error) throw error;

            return (data || []).filter(p => {
                const title = (p.title || p.name || '').toLowerCase();
                const desc = (p.description || '').toLowerCase();
                const brand = (p.brand || '').toLowerCase();
                const kws = Array.isArray(p.keywords) ? p.keywords.join(' ').toLowerCase() : '';

                return title.includes(cleanQuery) || 
                       desc.includes(cleanQuery) || 
                       brand.includes(cleanQuery) || 
                       kws.includes(cleanQuery);
            }).map((p, idx) => ({
                ...p,
                // Assign keyword rank score (1st place = 1.0, decending)
                keywordScore: 1.0 / (idx + 1)
            }));
        } catch (err) {
            logger.error(`[RAG HYBRID] Keyword search query failed: ${err.message}`, 'AI_RAG');
            return [];
        }
    },

    /**
     * Merges vector results and keyword matches using linear fusion.
     */
    mergeAndScore(vectorMatches, keywordMatches, budget) {
        const productMap = new Map();

        // 1. Process keyword matches
        keywordMatches.forEach(p => {
            productMap.set(String(p.id), {
                ...p,
                vectorScore: 0,
                keywordScore: p.keywordScore || 0.5,
                combinedScore: 0
            });
        });

        // 2. Process vector matches
        vectorMatches.forEach(v => {
            const id = String(v.id);
            if (productMap.has(id)) {
                const existing = productMap.get(id);
                existing.vectorScore = v.similarity || 0.5;
            } else {
                productMap.set(id, {
                    ...v,
                    vectorScore: v.similarity || 0.5,
                    keywordScore: 0,
                    combinedScore: 0
                });
            }
        });

        // 3. Compute combined scores (Weight: 60% Vector, 40% Keyword)
        const merged = Array.from(productMap.values());
        merged.forEach(p => {
            p.combinedScore = (0.6 * p.vectorScore) + (0.4 * p.keywordScore);
            
            // Apply budget penalty if product is over-budget
            if (budget && budget > 0) {
                const price = Number(p.price || 0);
                if (price > budget) {
                    const penalty = 1.0 - Math.min(0.8, (price - budget) / budget);
                    p.combinedScore *= penalty; // Degrade score
                }
            }
        });

        // Sort descending by score
        return merged.sort((a, b) => b.combinedScore - a.combinedScore);
    },

    /**
     * Reranks product lists based on user preferences and relevance.
     */
    rerankProducts(products, query, filters) {
        const { skinType, concern } = filters;
        const queryLower = query.toLowerCase();

        return products.map(p => {
            let rerankScore = p.combinedScore || 0.5;

            const title = (p.title || p.name || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            const keywords = Array.isArray(p.keywords) ? p.keywords.map(k => k.toLowerCase()) : [];

            // Skin Type matches
            if (skinType) {
                const isSkinMatch = keywords.includes(skinType.toLowerCase()) || 
                                    title.includes(skinType.toLowerCase()) ||
                                    desc.includes(skinType.toLowerCase());
                if (isSkinMatch) rerankScore += 0.2;
            }

            // Concern matches
            if (concern) {
                const isConcernMatch = keywords.includes(concern.toLowerCase()) || 
                                       title.includes(concern.toLowerCase()) ||
                                       desc.includes(concern.toLowerCase());
                if (isConcernMatch) rerankScore += 0.2;
            }

            // Exact keyword match from query
            if (queryLower && (title.includes(queryLower) || keywords.includes(queryLower))) {
                rerankScore += 0.3;
            }

            // Factor in rating and trust score (quality metrics)
            const ratingWeight = Number(p.rating || 4.2) / 5.0; // 0.8 to 1.0
            const trustWeight = Number(p.trust_score || 80) / 100.0; // 0.7 to 1.0
            rerankScore += (0.05 * ratingWeight) + (0.05 * trustWeight);

            return {
                ...p,
                rerankScore
            };
        }).sort((a, b) => b.rerankScore - a.rerankScore);
    },

    /**
     * Retrieves grounding articles from knowledge base.
     */
    async retrieveKnowledge(query, queryEmbedding, keys = {}) {
        let matches = [];

        if (queryEmbedding) {
            matches = await vectorStore.matchKnowledgeBase(queryEmbedding, 4);
        }

        // Add fallback search on text
        if (matches.length === 0) {
            try {
                const { data, error } = await supabase
                    .from('knowledge_base')
                    .select('topic, content, category');

                if (!error && data) {
                    const cleanQuery = query.toLowerCase();
                    matches = data.filter(k => {
                        const topic = (k.topic || '').toLowerCase();
                        const content = (k.content || '').toLowerCase();
                        return cleanQuery.includes(topic) || topic.includes(cleanQuery) || content.includes(cleanQuery);
                    }).slice(0, 3);
                }
            } catch (err) {
                logger.error(`[RAG HYBRID] KB text retrieval failed: ${err.message}`, 'AI_RAG');
            }
        }

        return matches;
    },

    /**
     * Retrieves genuine reviews for matched products.
     */
    async retrieveReviews(topProducts) {
        if (!topProducts || topProducts.length === 0) return [];
        const productIds = topProducts.map(p => Number(p.id)).filter(Boolean);

        try {
            const { data, error } = await supabase
                .from('reviews')
                .select('product_id, rating, review_text, verdict')
                .eq('verdict', 'Genuine')
                .in('product_id', productIds)
                .limit(5);

            if (error) throw error;
            return data || [];
        } catch (err) {
            logger.error(`[RAG HYBRID] Reviews retrieval failed: ${err.message}`, 'AI_RAG');
            return [];
        }
    }
};
