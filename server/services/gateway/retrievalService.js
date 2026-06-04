import { supabase } from '../../db.js';
import { logger } from '../../utils/logger.js';
import { vectorSearchService } from '../vectorSearchService.js';
import { sessionMemory } from '../vchat/sessionMemory.js';
import { productService } from '../productService.js';

export const retrievalService = {
    /**
     * Retrieves grounding context from the knowledge base, product inventory, and verified reviews.
     * @param {string} prompt User message or search query
     * @param {string} userId User session ID for memory reference
     * @returns {Object} Extracted context data: { knowledgeSnippets, products, reviews }
     */
    async retrieveContext(prompt, userId = null) {
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

            // 2. Query Products catalog using semantic search and pronoun resolution
            let products = [];
            const session = userId ? sessionMemory.get(userId) : null;

            // Check if query is a follow-up referring to the last recommended product
            const isFollowUp = session && session.lastProducts && session.lastProducts.length > 0 &&
                (/(?:ingredients?|reviews?|price|rating|trust|buy|source|url|details?|features?|pros|cons|actives)\b/i.test(lowerPrompt) ||
                 /\b(it|its|this|that|first|second|product|alternative|one)\b/i.test(lowerPrompt));

            if (isFollowUp) {
                const lastProdInfo = session.lastProducts[session.lastProducts.length - 1];
                logger.info(`[RETRIEVAL SERVICE] Detected follow-up query. Retrieving last recommended product ID=${lastProdInfo.id} ("${lastProdInfo.title}") from database.`, 'AI_GATEWAY');
                const fullProd = await productService.getProductById(lastProdInfo.id);
                if (fullProd) {
                    products = [fullProd];
                }
            }

            if (products.length === 0) {
                // Parse budget & category
                const budgetMatch = lowerPrompt.match(/(?:under|below|budget\s+of|<\s*|price\s*<\s*)\s*(?:rs\.?\s*|₹|\$)?\s*(\d+)/i) || 
                                    lowerPrompt.match(/(\d+)\s*(?:budget|max)/i);
                const budget = budgetMatch ? parseInt(budgetMatch[1]) : null;

                let category = null;
                const catMap = {
                    'Skincare & Beauty': ['serum', 'facewash', 'wash', 'cream', 'moisturizer', 'lotion', 'toner', 'cleanser', 'sunscreen', 'skincare', 'beauty'],
                    'Electronics': ['phone', 'mobile', 'headphones', 'buds', 'earbuds', 'watch', 'speaker', 'keyboard', 'mouse', 'monitor', 'router', 'powerbank', 'charger', 'laptop', 'notebook', 'macbook', 'pc', 'computer'],
                    'Fashion & Apparel': ['shirt', 'pant', 'jeans', 'shoes', 'sneakers', 'jacket', 'hoodie', 'apparel', 'fashion'],
                    'Groceries': ['tea', 'coffee', 'honey', 'oats', 'oil', 'milk', 'grocery', 'groceries'],
                    'Home & Living': ['chair', 'table', 'lamp', 'sofa', 'rug', 'chest', 'linen', 'desk', 'living']
                };

                for (const [catName, keywords] of Object.entries(catMap)) {
                    if (keywords.some(kw => lowerPrompt.includes(kw))) {
                        category = catName;
                        break;
                    }
                }

                logger.info(`[RETRIEVAL SERVICE] Querying semantic search: q="${prompt}", cat="${category || 'Any'}", budget=${budget || 'None'}`, 'AI_GATEWAY');
                products = await vectorSearchService.semanticSearch(prompt, category, budget, 5);
            }

            // Sync formats for frontend card mapping
            products = products.map(p => ({
                ...p,
                name: p.title || p.name
            }));

            // Requirement 5 Log: Retrieved products count & Selected products details
            console.log(`Retrieved products count: ${products.length}`);
            console.log(`Selected products: ${JSON.stringify(products.map(p => ({ id: p.id, title: p.title, price: p.price, rating: p.rating, trust_score: p.trust_score, category: p.category })))}`);

            // 3. Query Verified reviews for matched products
            let reviews = [];
            if (products.length > 0) {
                const productIds = products.map(p => p.id);
                const { data: feedbacks, error: feedErr } = await supabase
                    .from('reviews')
                    .select('*')
                    .in('product_id', productIds)
                    .limit(3);

                if (!feedErr && feedbacks && feedbacks.length > 0) {
                    reviews = feedbacks;
                } else {
                    const { data: newFeedbacks } = await supabase
                        .from('product_reviews')
                        .select('*')
                        .in('product_id', productIds)
                        .limit(3);
                    if (newFeedbacks) {
                        reviews = newFeedbacks;
                    }
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
