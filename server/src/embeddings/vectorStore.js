import { supabase } from '../../db.js';
import fetch from 'node-fetch';
import { logger } from '../../utils/logger.js';

export const vectorStore = {
    /**
     * Finds matching products based on query embeddings.
     */
    async matchProducts(queryEmbedding, category = null, limit = 10) {
        const storeType = process.env.VECTOR_DB_TYPE || 'supabase'; // 'supabase' | 'pinecone' | 'chroma'

        if (storeType === 'pinecone' && process.env.PINECONE_API_KEY) {
            try {
                // Call Pinecone query API
                const indexUrl = `https://${process.env.PINECONE_INDEX_HOST}/query`;
                const res = await fetch(indexUrl, {
                    method: 'POST',
                    headers: {
                        'Api-Key': process.env.PINECONE_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        vector: queryEmbedding,
                        topK: limit,
                        includeMetadata: true,
                        filter: category ? { category: { "$eq": category } } : undefined
                    })
                });

                if (res.ok) {
                    const json = await res.json();
                    return (json.matches || []).map(m => ({
                        id: m.id,
                        similarity: m.score,
                        ...m.metadata
                    }));
                }
            } catch (err) {
                logger.error(`[VECTOR STORE] Pinecone product search failed: ${err.message}`, 'AI_VECTOR');
            }
        }

        // Default: Supabase pgvector RPC with signature fallback
        try {
            let data = null;
            let error = null;

            try {
                const response = await supabase.rpc('match_products', {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.05,
                    match_count: limit,
                    category_filter: category || null
                });
                data = response.data;
                error = response.error;
            } catch (rpcErr) {
                error = rpcErr;
            }

            if (error && (error.code === 'PGRST202' || error.message?.includes('Could not find') || error.message?.includes('schema cache'))) {
                logger.warn(`[VECTOR STORE] 4-parameter match_products RPC signature not found, retrying with 3-parameter...`, 'AI_VECTOR');
                try {
                    const response = await supabase.rpc('match_products', {
                        query_embedding: queryEmbedding,
                        match_threshold: 0.05,
                        match_count: limit
                    });
                    data = response.data;
                    error = response.error;

                    if (data && category) {
                        data = data.filter(p => p.category?.toLowerCase() === category.toLowerCase());
                    }
                } catch (fallbackErr) {
                    error = fallbackErr;
                }
            }

            if (error) throw error;
            return data || [];
        } catch (err) {
            logger.error(`[VECTOR STORE] Supabase pgvector products match failed: ${err.message}`, 'AI_VECTOR');
            return []; // Return empty, caller will cascade to local text search fallback
        }
    },

    /**
     * Finds matching knowledge base snippets based on query embeddings.
     */
    async matchKnowledgeBase(queryEmbedding, limit = 5) {
        const storeType = process.env.VECTOR_DB_TYPE || 'supabase';

        if (storeType === 'pinecone' && process.env.PINECONE_API_KEY) {
            try {
                const indexUrl = `https://${process.env.PINECONE_INDEX_HOST}/query`;
                const res = await fetch(indexUrl, {
                    method: 'POST',
                    headers: {
                        'Api-Key': process.env.PINECONE_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        vector: queryEmbedding,
                        topK: limit,
                        includeMetadata: true
                    })
                });

                if (res.ok) {
                    const json = await res.json();
                    return (json.matches || []).map(m => ({
                        topic: m.metadata.topic,
                        content: m.metadata.content,
                        category: m.metadata.category,
                        similarity: m.score
                    }));
                }
            } catch (err) {
                logger.error(`[VECTOR STORE] Pinecone KB match failed: ${err.message}`, 'AI_VECTOR');
            }
        }

        // Default: Supabase knowledge base match via PostgreSQL pgvector cosine similarity
        try {
            // Check if match_knowledge RPC exists or do a query ordering by cosine distance
            const { data, error } = await supabase
                .from('knowledge_base')
                .select('topic, content, category, similarity:embedding <=> $1', { count: 'exact' }) // or use an RPC if available
                .order('embedding <=> ' + JSON.stringify(queryEmbedding))
                .limit(limit);

            if (error) {
                // If the custom operator order fails, query raw and fallback to local scoring
                const { data: rawData, error: fetchErr } = await supabase
                    .from('knowledge_base')
                    .select('topic, content, category');
                if (fetchErr) throw fetchErr;
                return rawData.slice(0, limit);
            }

            return data || [];
        } catch (err) {
            logger.error(`[VECTOR STORE] Supabase pgvector KB search failed: ${err.message}`, 'AI_VECTOR');
            return [];
        }
    },

    /**
     * Saves a knowledge base document with its vector embedding.
     */
    async insertKnowledgeBaseDoc(doc, embedding) {
        try {
            const { error } = await supabase
                .from('knowledge_base')
                .insert({
                    title: doc.topic || doc.title,
                    topic: doc.topic || doc.title,
                    content: doc.content,
                    category: doc.category || doc.sub_topic,
                    sub_topic: doc.category || doc.sub_topic,
                    embedding: embedding
                });

            if (error) throw error;
            return true;
        } catch (err) {
            logger.error(`[VECTOR STORE] Failed to insert KB document: ${err.message}`, 'AI_VECTOR');
            return false;
        }
    }
};
