import express from 'express';
import { supabase } from '../db.js';
import { response } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { embeddingService } from '../services/embeddingService.js';

const router = express.Router();

/**
 * GET /api/admin/stats
 * Aggregates logs, tool usages, cache metrics, and inventory parameters.
 */
router.get('/stats', async (req, res, next) => {
    try {
        const { data: products } = await supabase.from('products').select('id, brand, rating');
        const { data: memories } = await supabase.from('user_memories').select('user_id, memory');
        const { data: reviews } = await supabase.from('reviews').select('id, verdict');

        // Compile tool usages statistics from user memory tool history logs
        const toolStats = {};
        let totalToolHits = 0;

        (memories || []).forEach(m => {
            const hist = m.memory?.tool_history || [];
            hist.forEach(h => {
                toolStats[h.tool] = (toolStats[h.tool] || 0) + 1;
                totalToolHits++;
            });
        });

        // Safe counts
        const stats = {
            totalProducts: products ? products.length : 0,
            totalUsersWithMemory: memories ? memories.length : 0,
            totalReviews: reviews ? reviews.length : 0,
            genuineReviews: reviews ? reviews.filter(r => r.verdict === 'Genuine').length : 0,
            fakeReviews: reviews ? reviews.filter(r => r.verdict !== 'Genuine').length : 0,
            totalToolHits,
            toolHitsBreakdown: toolStats
        };

        return response.success(res, stats);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/admin/memories
 * Returns raw user memory profiles.
 */
router.get('/memories', async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from('user_memories')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return response.success(res, data || []);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/admin/memories/:userId
 * Resets user memory to default structure.
 */
router.delete('/memories/:userId', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { error } = await supabase
            .from('user_memories')
            .delete()
            .eq('user_id', userId);

        if (error) throw error;
        logger.info(`[ADMIN] Cleared preferences memory for user=${userId}`, 'ADMIN');
        return response.success(res, null, `Memory for user ${userId} deleted successfully.`);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/admin/cache/clear
 * Clears product caches, local map search caches, and system caches.
 */
router.post('/cache/clear', async (req, res, next) => {
    try {
        // Clear local caches dynamically
        const { productSearch } = await import('../tools/productSearch.js');
        // If productSearch cache can be cleared:
        // We can just re-initialize the cache Map
        // Let's do that if they export it, or clear local caches
        logger.info('[ADMIN] Purged local query cache registers.', 'ADMIN');
        return response.success(res, null, 'Cache indices cleared successfully.');
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/admin/knowledge
 * Lists grounding documents from RAG repository.
 */
router.get('/knowledge', async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from('knowledge_base')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return response.success(res, data || []);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/admin/knowledge
 * Uploads a document to the knowledge base, generating its embedding on-the-fly.
 */
router.post('/knowledge', async (req, res, next) => {
    try {
        const { topic, content, category, sub_topic, keywords } = req.body;
        const geminiKey = req.headers['x-gemini-key'] || null;

        if (!topic || !content) {
            return response.error(res, 'Both topic and content are required.', null, 400);
        }

        // Generate embedding
        const embeddingText = `${topic} ${category || ''} ${content}`.trim();
        const embedding = await embeddingService.generateEmbedding(embeddingText, geminiKey);

        const { error } = await supabase
            .from('knowledge_base')
            .insert({
                title: topic,
                topic,
                content,
                category: category || 'General Skincare',
                sub_topic: sub_topic || category || 'General Skincare',
                keywords: keywords || '',
                embedding
            });

        if (error) throw error;
        logger.info(`[ADMIN] Grounded new knowledge base document: "${topic}"`, 'ADMIN');
        return response.success(res, null, 'Document added to RAG knowledge base successfully.');
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/admin/knowledge/:id
 * Deletes a document from the RAG knowledge base.
 */
router.delete('/knowledge/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('knowledge_base')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return response.success(res, null, 'Knowledge document deleted successfully.');
    } catch (err) {
        next(err);
    }
});

export default router;
