import { supabase } from '../db.js';

/**
 * RAG Service: Retrieval-Augmented Generation
 * This service retrieves relevant context from the knowledge base, 
 * product inventory, and verified feedbacks to provide grounded answers.
 */
export const queryRAG = async (prompt) => {
    const lowerPrompt = prompt.toLowerCase();
    
    try {
        // 1. RETRIEVAL - Searching Knowledge Base from Supabase
        const { data: allKnowledge, error: kbErr } = await supabase
            .from('knowledge_base')
            .select('*');

        if (kbErr) throw kbErr;

        // Filter knowledge in memory
        const knowledgeSnippets = (allKnowledge || []).filter(snippet => {
            const topic = (snippet.topic || '').toLowerCase();
            const keywordsStr = (snippet.keywords || '').toLowerCase();
            const keywords = keywordsStr.split(',').map(k => k.trim()).filter(Boolean);

            return lowerPrompt.includes(topic) || keywords.some(kw => lowerPrompt.includes(kw));
        });
        
        // 2. RETRIEVAL - Searching Products from Supabase
        const { data: allProducts, error: prodErr } = await supabase
            .from('products')
            .select('*');

        if (prodErr) throw prodErr;

        // Filter products in memory
        const products = (allProducts || []).filter(p => {
            const title = (p.title || p.name || '').toLowerCase();
            const category = (p.category || '').toLowerCase();

            return lowerPrompt.includes(title) || lowerPrompt.includes(category);
        }).map(p => ({
            ...p,
            name: p.title || p.name || 'Skincare Product' // map to name for frontend compatibility
        }));

        // 3. RETRIEVAL - Searching Verified Feedback from Supabase
        let feedbackHighlights = [];
        if (products.length > 0) {
            const productNames = products.map(p => p.name);
            const { data: feedbacks, error: feedErr } = await supabase
                .from('reviews')
                .select('*')
                .eq('verdict', 'Genuine')
                .in('product_name', productNames)
                .limit(3);

            if (feedErr) throw feedErr;
            feedbackHighlights = feedbacks || [];
        }

        // 4. SYNTHESIS - Constructing the Response
        let responseText = "";

        // Header logic
        if (knowledgeSnippets.length > 0) {
            responseText += `💡 **Scientific Insights Found:**\n\n`;
            knowledgeSnippets.forEach(snippet => {
                responseText += `*   **${snippet.topic}**: ${snippet.content}\n`;
            });
            responseText += `\n---\n\n`;
        }

        if (products.length > 0) {
            responseText += `📦 **Inventory Match:** Based on your interest, I found the **${products[0].name}** ($${products[0].price}). It fits into our ${products[0].category} category.\n\n`;
            
            if (feedbackHighlights.length > 0) {
                responseText += `✅ **Community Verdict:** We have ${feedbackHighlights.length}+ verified genuine reviews for this item. Users generally report: "${feedbackHighlights[0].review_text.substring(0, 100)}..."\n\n`;
            }
        }

        // Default fallback if nothing found
        if (!responseText) {
            // Get a few unique topics for suggestions
            const uniqueTopics = [...new Set((allKnowledge || []).map(k => k.topic))].slice(0, 5);
            const suggestions = uniqueTopics.join(', ') || 'Salicylic Acid, Neem, Ubtan';
            return `🔍 **Neural Scan Complete:** I couldn't find a direct correlation for that specific query in my current scientific repository.\n\nHowever, my core intelligence is grounded in: **${suggestions}**, and our **Himalaya & Derma Co** inventory. Would you like to explore one of these specialized topics?`;
        }

        responseText += `\n\n📝 **AI Summary:** Combining the scientific data with our inventory, this choice is scientifically grounded for your specific skin concerns.`;

        return responseText;
    } catch (err) {
        console.error('[RAG SERVICE ERROR] Failed to perform RAG:', err.message);
        return `⚠️ **AI RAG Error:** An error occurred while fetching clinical data: ${err.message}. Please try again shortly.`;
    }
};
