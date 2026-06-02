import { supabase } from '../../db.js';
import { logger } from '../../utils/logger.js';

export const retrievalService = {
    /**
     * Retrieves grounding context from the knowledge base, product inventory, and verified reviews.
     * @param {string} prompt User message or search query
     * @returns {Object} Extracted context data: { knowledgeSnippets, products, reviews }
     */
    async retrieveContext(prompt) {
        const lowerPrompt = prompt.toLowerCase();
        
        try {
            logger.info(`[RETRIEVAL SERVICE] Querying DB context for: "${prompt.substring(0, 50)}"`, 'AI_GATEWAY');

            // 1. Query Knowledge Base
            const { data: allKnowledge, error: kbErr } = await supabase
                .from('knowledge_base')
                .select('*');

            if (kbErr) {
                logger.error('[RETRIEVAL SERVICE] Failed to fetch knowledge base', kbErr, 'AI_GATEWAY');
            }

            const knowledgeSnippets = (allKnowledge || []).filter(snippet => {
                const topic = (snippet.topic || '').toLowerCase();
                const keywordsStr = (snippet.keywords || '').toLowerCase();
                const keywords = keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
                return lowerPrompt.includes(topic) || keywords.some(kw => lowerPrompt.includes(kw));
            });

            // 2. Query Products catalog
            const { data: allProducts, error: prodErr } = await supabase
                .from('products')
                .select('*');

            if (prodErr) {
                logger.error('[RETRIEVAL SERVICE] Failed to fetch products catalog', prodErr, 'AI_GATEWAY');
            }

            const products = (allProducts || []).filter(p => {
                const title = (p.title || p.name || '').toLowerCase();
                const category = (p.category || '').toLowerCase();
                return lowerPrompt.includes(title) || lowerPrompt.includes(category);
            }).map(p => ({
                ...p,
                name: p.title || p.name || 'Skincare Product'
            }));

            // 3. Query Verified reviews for matched products
            let reviews = [];
            if (products.length > 0) {
                const productNames = products.map(p => p.name);
                const { data: feedbacks, error: feedErr } = await supabase
                    .from('reviews')
                    .select('*')
                    .eq('verdict', 'Genuine')
                    .in('product_name', productNames)
                    .limit(3);

                if (!feedErr && feedbacks) {
                    reviews = feedbacks;
                }
            }

            return {
                knowledgeSnippets: knowledgeSnippets.slice(0, 4),
                products: products.slice(0, 5),
                reviews
            };
        } catch (err) {
            logger.error('[RETRIEVAL SERVICE ERROR] Failed to perform retrieval:', err, 'AI_GATEWAY');
            return { knowledgeSnippets: [], products: [], reviews: [] };
        }
    }
};
