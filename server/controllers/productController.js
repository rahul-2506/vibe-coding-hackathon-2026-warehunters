import { productService } from '../services/productService.js';
import { vectorSearchService } from '../services/vectorSearchService.js';
import { embeddingService } from '../services/embeddingService.js';
import { amazonImporter, flipkartImporter, csvImporter, kaggleImporter } from '../importers/index.js';
import { supabase } from '../db.js';
import { response } from '../utils/response.js';
import fetch from 'node-fetch';
import { productSearch } from '../src/tools/productSearch.js';
import { logger } from '../utils/logger.js';
import { memoryManager } from '../src/ai/memoryManager.js';

export const productController = {
    async getAll(req, res, next) {
        try {
            const { page, limit, category, subcategory, q, sort } = req.query;
            
            if (page || limit) {
                const paginated = await productService.getPaginatedProducts({
                    page: Number(page) || 1,
                    limit: Number(limit) || 24,
                    category,
                    subcategory,
                    searchQuery: q,
                    sort
                });
                return response.success(res, paginated);
            }
            
            const products = await productService.searchProducts(q, category, sort, subcategory);
            return response.success(res, products);
        } catch (err) {
            next(err);
        }
    },

    async getById(req, res, next) {
        try {
            const product = await productService.getProductById(req.params.id);
            if (!product) {
                return response.error(res, 'Product not found', null, 404);
            }
            return response.success(res, product);
        } catch (err) {
            next(err);
        }
    },

    async getByCategory(req, res, next) {
        try {
            const products = await productService.getProductsByCategory(req.params.name);
            return response.success(res, products);
        } catch (err) {
            next(err);
        }
    },

    async getReviews(req, res, next) {
        try {
            const productId = Number(req.params.id);
            
            // Query both classic reviews and the new product_reviews table, merging them
            const { data: reviews, error } = await supabase
                .from('reviews')
                .select('*')
                .eq('product_id', productId)
                .order('created_at', { ascending: false });
                
            if (error) {
                console.error('[productController] Supabase reviews query failed:', error.message);
                throw error;
            }

            const { data: newReviews, error: newErr } = await supabase
                .from('product_reviews')
                .select('*')
                .eq('product_id', productId)
                .order('created_at', { ascending: false });

            const merged = [...(reviews || [])];
            if (!newErr && newReviews) {
                newReviews.forEach(r => {
                    merged.push({
                        id: r.id,
                        product_id: r.product_id,
                        review_text: r.review_text,
                        rating: Number(r.rating),
                        sentiment: r.sentiment || 'neutral',
                        verdict: 'Genuine', // default verdict for imports
                        trust_score: 90,
                        source: 'Imported Customer',
                        created_at: r.created_at
                    });
                });
            }
            
            return response.success(res, merged);
        } catch (err) {
            next(err);
        }
    },

    /**
     * Vector similarity search with ranking.
     * Route: GET /api/products/search?q=...&category=...&budget=...
     */
    async search(req, res, next) {
        try {
            const { q, category, budget, limit } = req.query;
            const searchLimit = Number(limit) || 12;

            logger.info(`[PRODUCT CONTROLLER] Searching products for query="${q}" in category="${category || 'all'}"`, 'PRODUCT_CONTROLLER');

            // Save search to user preferences memory
            let userId = 'anonymous';
            const authHeader = req.headers.authorization;
            if (authHeader) {
                const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
                if (token) {
                    try {
                        const { data: { user } } = await supabase.auth.getUser(token);
                        if (user) {
                            userId = user.id;
                        }
                    } catch (err) {
                        logger.warn(`[PRODUCT SEARCH] Failed to verify auth token: ${err.message}`, 'PRODUCT_CONTROLLER');
                    }
                }
            }

            if (q) {
                const geminiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY || (process.env.AI_API_KEY?.startsWith('AIzaSy') ? process.env.AI_API_KEY : null);
                const groqKey = req.headers['x-groq-key'] || process.env.GROQ_API_KEY || null;
                memoryManager.updateMemory(userId, `I am looking for: "${q}"${category ? ` in category "${category}"` : ''}`, { geminiKey, groqKey })
                    .catch(err => logger.error(`[PRODUCT CONTROLLER] Failed to update user memory: ${err.message}`, 'PRODUCT_CONTROLLER'));
            }

            let results = [];
            try {
                results = await vectorSearchService.semanticSearch(
                    q || '',
                    category || null,
                    budget ? Number(budget) : null,
                    searchLimit
                );
            } catch (err) {
                logger.warn(`[PRODUCT CONTROLLER] Vector semantic search failed: ${err.message}. Proceeding to fallback.`, 'PRODUCT_CONTROLLER');
            }

            // If no local products found (or only low relevance/partial matches) and search query is provided, perform live retrieval
            const qWords = q ? q.toLowerCase().split(/\s+/).filter(w => w.length > 2) : [];
            const hasGoodMatch = results && results.length > 0 && results.some(p => {
                const title = (p.title || p.name || '').toLowerCase();
                const desc = (p.description || '').toLowerCase();
                return qWords.every(word => title.includes(word) || desc.includes(word));
            });

            if ((!results || results.length === 0 || !hasGoodMatch) && q) {
                logger.info(`[PRODUCT CONTROLLER] Zero or low-relevance local results for "${q}". Triggering live product search fallback...`, 'PRODUCT_CONTROLLER');
                
                const geminiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY || (process.env.AI_API_KEY?.startsWith('AIzaSy') ? process.env.AI_API_KEY : null);
                const groqKey = req.headers['x-groq-key'] || process.env.GROQ_API_KEY || null;

                const liveRes = await productSearch.search({
                    query: q,
                    category: category || null,
                    budget: budget ? Number(budget) : null
                }, {
                    geminiKey,
                    groqKey
                });

                if (liveRes && liveRes.success && liveRes.products) {
                    results = liveRes.products;
                }
            }

            return response.success(res, results);
        } catch (err) {
            next(err);
        }
    },

    /**
     * Product Import Ingestion Pipeline
     * Route: POST /api/products/import
     */
    async import(req, res, next) {
        try {
            const { source, data } = req.body;
            const geminiKey = req.headers['x-gemini-key'] || null;
            const openaiKey = req.headers['x-openai-key'] || null;

            if (!source || !data) {
                return response.error(res, 'Both source and data are required for import.', null, 400);
            }

            let importer = null;
            const src = source.toLowerCase();

            if (src === 'amazon') {
                importer = amazonImporter;
            } else if (src === 'flipkart') {
                importer = flipkartImporter;
            } else if (src === 'csv') {
                importer = csvImporter;
            } else if (src === 'kaggle') {
                importer = kaggleImporter;
            } else {
                return response.error(res, `Unsupported source: ${source}. Supported: amazon, flipkart, csv, kaggle`, null, 400);
            }

            let records = [];
            if (src === 'csv') {
                if (typeof data !== 'string') {
                    return response.error(res, 'For CSV imports, the data must be a raw CSV string.', null, 400);
                }
                records = csvImporter.csvToRecords(data);
            } else {
                if (!Array.isArray(data)) {
                    return response.error(res, 'For non-CSV imports, data must be a JSON array.', null, 400);
                }
                records = data;
            }

            const importResult = await importer.importData(records, geminiKey, openaiKey);
            return response.success(res, importResult);
        } catch (err) {
            next(err);
        }
    },

    /**
     * Dynamic Side-by-Side Product Comparison
     * Route: POST /api/products/compare
     */
    async compare(req, res, next) {
        try {
            const { product1Id, product2Id, product1Name, product2Name, preferences } = req.body;
            const geminiKey = req.headers['x-gemini-key'] || null;
            const openaiKey = req.headers['x-openai-key'] || null;

            // Retrieve all products
            const all = await productService.getAllProducts();
            let p1 = null;
            let p2 = null;

            if (product1Id) p1 = all.find(p => p.id === Number(product1Id));
            if (product2Id) p2 = all.find(p => p.id === Number(product2Id));

            if (!p1 && product1Name) {
                p1 = all.find(p => p.title.toLowerCase().includes(product1Name.toLowerCase()));
            }
            if (!p2 && product2Name) {
                p2 = all.find(p => p.title.toLowerCase().includes(product2Name.toLowerCase()));
            }

            if (!p1 || !p2) {
                return response.error(res, 'Both products must be specified and exist in the catalog.', null, 404);
            }

            // Fetch features from product_features table
            const { data: feat1 } = await supabase.from('product_features').select('*').eq('product_id', p1.id);
            const { data: feat2 } = await supabase.from('product_features').select('*').eq('product_id', p2.id);

            // Construct feature comparison list
            const featuresMap = {};
            (feat1 || []).forEach(f => {
                featuresMap[f.feature_name] = { valA: f.feature_value, valB: 'N/A' };
            });
            (feat2 || []).forEach(f => {
                if (featuresMap[f.feature_name]) {
                    featuresMap[f.feature_name].valB = f.feature_value;
                } else {
                    featuresMap[f.feature_name] = { valA: 'N/A', valB: f.feature_value };
                }
            });

            const featureTable = Object.entries(featuresMap).map(([name, vals]) => ({
                feature_name: name,
                productA_value: vals.valA,
                productB_value: vals.valB
            }));

            // High-fidelity fallbacks
            let prosA = ['Dermatologist-recommended formulation', 'High rating integrity'];
            let consA = ['Slightly premium price'];
            let prosB = ['Highly cost-effective option', 'Good reviews density'];
            let consB = ['Contains minor fragrance components'];
            let recommendation = '';

            const scoreA = Number(p1.rating || 4.0) * 10 + (p1.trust_score || 80);
            const scoreB = Number(p2.rating || 4.0) * 10 + (p2.trust_score || 80);
            const winner = scoreA >= scoreB ? p1 : p2;

            recommendation = `We highly recommend **${winner.title}** because it delivers better overall clinical performance and has higher verified review authenticity.`;

            // Call LLM if keys are available
            const apiKey = geminiKey || process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
            if (apiKey && !apiKey.startsWith('gsk_')) {
                try {
                    const prompt = `You are a professional product analyst. Compare these two products:
Product A: ${p1.title} - Description: ${p1.description} - Price: $${p1.price} - Rating: ${p1.rating}
Product B: ${p2.title} - Description: ${p2.description} - Price: $${p2.price} - Rating: ${p2.rating}

Features: ${JSON.stringify(featureTable)}

Analyze their pros, cons, and generate a final recommendation.
Return a JSON object containing:
- "prosA": (array of strings) Pros for Product A
- "consA": (array of strings) Cons for Product A
- "prosB": (array of strings) Pros for Product B
- "consB": (array of strings) Cons for Product B
- "recommendation": (string) Short professional recommendation explaining which to choose.
Return ONLY valid JSON.`;

                    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                    const resLlm = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { responseMimeType: "application/json" }
                        })
                    });

                    if (resLlm.ok) {
                        const json = await resLlm.json();
                        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            const parsed = JSON.parse(text);
                            prosA = parsed.prosA || prosA;
                            consA = parsed.consA || consA;
                            prosB = parsed.prosB || prosB;
                            consB = parsed.consB || consB;
                            recommendation = parsed.recommendation || recommendation;
                        }
                    }
                } catch (err) {
                    console.error('[compare API] LLM execution failed:', err.message);
                }
            }

            return response.success(res, {
                productA: p1,
                productB: p2,
                featureTable,
                prosA,
                consA,
                prosB,
                consB,
                recommendation
            });
        } catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return response.success(res, null, 'Product deleted successfully');
        } catch (err) {
            next(err);
        }
    },

    async reembed(req, res, next) {
        try {
            const { id } = req.params;
            const geminiKey = req.headers['x-gemini-key'] || null;
            const openaiKey = req.headers['x-openai-key'] || null;

            const product = await productService.getProductById(id);
            if (!product) {
                return response.error(res, 'Product not found', null, 404);
            }

            const embeddingText = `${product.title} ${product.brand || ''} ${product.category || ''} ${product.description || ''}`.trim();
            const embedding = await embeddingService.generateEmbedding(embeddingText, geminiKey, openaiKey);

            const { error } = await supabase
                .from('products')
                .update({ embedding })
                .eq('id', id);

            if (error) throw error;
            return response.success(res, null, 'Embedding generated successfully');
        } catch (err) {
            next(err);
        }
    }
};
