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

function cleanQueryForMatching(query) {
    if (!query) return '';
    let q = query.toLowerCase().replace(/,/g, '');
    
    // Remove budget matches like "under 30000", "below 30000", "less than 30000"
    q = q.replace(/under\s*\d+/gi, '');
    q = q.replace(/below\s*\d+/gi, '');
    q = q.replace(/less\s*than\s*\d+/gi, '');
    q = q.replace(/above\s*\d+/gi, '');
    q = q.replace(/greater\s*than\s*\d+/gi, '');
    q = q.replace(/\b\d{4,}\b/g, ''); // Remove any 4+ digit number (prices like 30000)
    
    // Remove qualitative/stop words
    const wordsToRemove = ['best', 'cheap', 'top', 'buy', 'shop', 'price', 'budget', 'under', 'below', 'above', 'less', 'than', 'greater', 'for'];
    for (const w of wordsToRemove) {
        q = q.replace(new RegExp('\\b' + w + '\\b', 'gi'), '');
    }
    
    return q.replace(/\s+/g, ' ').trim();
}

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
     * Vector similarity search with ranking and cursor-based pagination.
     * Route: GET /api/products/search?q=...&category=...&budget=...&cursor=...&limit=...
     */
    async search(req, res, next) {
        try {
            const { q, category, subcategory, budget, limit, cursor, brand, marketplace, priceMin, priceMax } = req.query;
            
            const limitVal = Number(limit) || 20;
            const cursorVal = Number(cursor) || 0;
            
            logger.info(`[PRODUCT CONTROLLER] Searching products for query="${q}" in category="${category || 'all'}" cursor=${cursorVal} limit=${limitVal}`, 'PRODUCT_CONTROLLER');

            // Extract budget from query q if not explicitly passed
            let budgetVal = budget ? Number(budget) : null;
            if (!budgetVal && q) {
                const underMatch = q.match(/under\s*(\d+)/i);
                if (underMatch) budgetVal = Number(underMatch[1]);
                const belowMatch = q.match(/below\s*(\d+)/i);
                if (belowMatch) budgetVal = Number(belowMatch[1]);
                const lessThanMatch = q.match(/less\s*than\s*(\d+)/i);
                if (lessThanMatch) budgetVal = Number(lessThanMatch[1]);
            }

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

            const geminiKey = req.headers['x-gemini-key'] || null;
            const openaiKey = req.headers['x-openai-key'] || null;
            const groqKey = req.headers['x-groq-key'] || process.env.GROQ_API_KEY || null;

            if (q) {
                const memoryGeminiKey = geminiKey || process.env.GEMINI_API_KEY || (process.env.AI_API_KEY?.startsWith('AIzaSy') ? process.env.AI_API_KEY : null);
                memoryManager.updateMemory(userId, `I am looking for: "${q}"${category ? ` in category "${category}"` : ''}`, { geminiKey: memoryGeminiKey, groqKey })
                    .catch(err => logger.error(`[PRODUCT CONTROLLER] Failed to update user memory: ${err.message}`, 'PRODUCT_CONTROLLER'));
            }

            // Load user preferences if logged in
            let userPreferences = null;
            if (userId && userId !== 'anonymous') {
                try {
                    const { data } = await supabase
                        .from('user_preferences')
                        .select('*')
                        .eq('user_id', userId)
                        .single();
                    if (data) {
                        userPreferences = data;
                    }
                } catch (prefErr) {
                    logger.warn(`[PRODUCT SEARCH] Failed to load user preferences: ${prefErr.message}`, 'PRODUCT_CONTROLLER');
                }
            }

            const sortTypeVal = req.query.sort || 'trust_score';
            let results = [];
            try {
                results = await vectorSearchService.semanticSearch(
                    q || '',
                    category || null,
                    budgetVal,
                    100, // Fetch a reasonably large candidate set for RRF and metadata filters
                    userPreferences,
                    { geminiKey, openaiKey }
                );
            } catch (err) {
                logger.warn(`[PRODUCT CONTROLLER] Vector semantic search failed: ${err.message}. Proceeding with empty results.`, 'PRODUCT_CONTROLLER');
            }

            // Sync formats for frontend compatibility
            results = results.map(p => ({
                ...p,
                name: p.title || p.name,
                thumbnail: p.thumbnail || p.image_url || p.image || '',
                image_url: p.image_url || p.thumbnail || p.image || '',
                review_count: p.review_count || p.reviews_count || p.reviewCount || 0
            }));

            // Apply filter parameters
            let filteredResults = [...results];

            // 1. Category filter (strictly enforce category)
            if (category && category !== 'All') {
                const cLower = category.toLowerCase();
                filteredResults = filteredResults.filter(p => (p.category || '').toLowerCase() === cLower);
            }

            // 1b. Subcategory filter
            if (subcategory && subcategory !== 'All') {
                const sLower = subcategory.toLowerCase();
                filteredResults = filteredResults.filter(p => (p.subcategory || '').toLowerCase() === sLower);
            }

            // 2. Brand filter (supports comma-separated list)
            if (brand) {
                const brandsList = brand.toLowerCase().split(',').map(b => b.trim());
                filteredResults = filteredResults.filter(p => brandsList.includes((p.brand || '').toLowerCase()));
            }

            // 3. Marketplace filter (supports comma-separated list)
            if (marketplace) {
                const marketplacesList = marketplace.toLowerCase().split(',').map(m => m.trim());
                filteredResults = filteredResults.filter(p => 
                    marketplacesList.includes((p.source || '').toLowerCase()) || 
                    marketplacesList.includes((p.specifications?.Merchant || '').toLowerCase())
                );
            }

            // 4. Price range filters
            if (priceMin) {
                const min = Number(priceMin);
                filteredResults = filteredResults.filter(p => Number(p.price || 0) >= min);
            }
            const maxPriceVal = budgetVal ? Number(budgetVal) : (priceMax ? Number(priceMax) : null);
            if (maxPriceVal) {
                filteredResults = filteredResults.filter(p => Number(p.price || 0) <= maxPriceVal);
            }

            // 5. Rating filter
            if (req.query.minRating) {
                const minRatingVal = Number(req.query.minRating);
                filteredResults = filteredResults.filter(p => Number(p.rating || 0) >= minRatingVal);
            }

            // 6. Trust score filter
            if (req.query.minTrustScore) {
                const minTrustScoreVal = Number(req.query.minTrustScore);
                filteredResults = filteredResults.filter(p => Number(p.trust_score || 80) >= minTrustScoreVal);
            }

            // 7. Stock availability filter
            if (req.query.onlyInStock === 'true') {
                filteredResults = filteredResults.filter(p => p.availability === 'In Stock');
            }

            // Apply sorting before pagination slice
            const sortType = req.query.sort || 'trust_score';
            filteredResults.sort((a, b) => {
                if (sortType === 'trust_score') {
                    return (b.trust_score || 80) - (a.trust_score || 80);
                }
                if (sortType === 'rating') {
                    return b.rating - a.rating;
                }
                if (sortType === 'price_asc') {
                    return a.price - b.price;
                }
                if (sortType === 'price_desc') {
                    return b.price - a.price;
                }
                return 0;
            });

            // Deduplicate products by title and ID to satisfy duplicate avoidance
            const seenIds = new Set();
            const seenTitles = new Set();
            const uniqueFilteredResults = [];
            for (const p of filteredResults) {
                const idKey = String(p.id);
                const titleKey = (p.title || p.name || '').toLowerCase().trim();
                if (!seenIds.has(idKey) && !seenTitles.has(titleKey)) {
                    seenIds.add(idKey);
                    seenTitles.add(titleKey);
                    uniqueFilteredResults.push(p);
                }
            }
            filteredResults = uniqueFilteredResults;

            // Paginate results using cursor offset
            const pageProducts = filteredResults.slice(cursorVal, cursorVal + limitVal);
            const hasMore = cursorVal + limitVal < filteredResults.length;
            const nextCursor = hasMore ? cursorVal + limitVal : null;

            return response.success(res, {
                products: pageProducts,
                nextCursor,
                totalEstimate: filteredResults.length
            });
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
            const apiKey = process.env.GROQ_API_KEY;
            if (apiKey) {
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

                    const url = `https://api.groq.com/openai/v1/chat/completions`;
                    const resLlm = await fetch(url, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: "llama-3.3-70b-versatile",
                            messages: [
                                { role: "user", content: prompt }
                            ],
                            response_format: { type: "json_object" },
                            temperature: 0.1
                        })
                    });

                    if (resLlm.ok) {
                        const json = await resLlm.json();
                        const text = json.choices?.[0]?.message?.content;
                        if (text) {
                            const parsed = JSON.parse(text);
                            prosA = parsed.prosA || prosA;
                            consA = parsed.consA || consA;
                            prosB = parsed.prosB || prosB;
                            consB = parsed.consB || consB;
                            recommendation = parsed.recommendation || recommendation;
                        }
                    } else {
                        console.error('[compare API] Groq API returned error:', resLlm.status);
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
    },

    async logEvent(req, res, next) {
        try {
            const { productId, eventType, metadata } = req.body;
            if (!eventType) {
                return response.error(res, 'Event type is required', null, 400);
            }

            let userId = null;
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
                        logger.warn(`[PRODUCT EVENT] Failed to verify auth token: ${err.message}`, 'PRODUCT_CONTROLLER');
                    }
                }
            }

            const { data, error } = await supabase
                .from('user_product_events')
                .insert({
                    user_id: userId,
                    product_id: productId ? Number(productId) : null,
                    event_type: eventType,
                    metadata: metadata || {},
                    created_at: new Date().toISOString()
                })
                .select();

            if (error) {
                logger.error(`[PRODUCT EVENT ERROR] Failed to insert event: ${error.message}`, 'PRODUCT_CONTROLLER');
                throw error;
            }

            // Update user_preferences / memory dynamically
            if (userId && productId) {
                const product = await productService.getProductById(productId);
                if (product) {
                    const { data: existingPrefs } = await supabase
                        .from('user_preferences')
                        .select('*')
                        .eq('user_id', userId)
                        .single();

                    const prefs = existingPrefs || {
                        user_id: userId,
                        skin_type: 'normal',
                        budget: 1500,
                        concerns: [],
                        preferred_brands: [],
                        disliked_ingredients: [],
                        product_interests: []
                    };

                    if (product.brand && !prefs.preferred_brands.includes(product.brand)) {
                        prefs.preferred_brands.push(product.brand);
                    }

                    const interests = Array.isArray(prefs.product_interests) ? prefs.product_interests : [];
                    if (!interests.includes(productId)) {
                        interests.push(productId);
                        prefs.product_interests = interests;
                    }

                    await supabase
                        .from('user_preferences')
                        .upsert({
                            ...prefs,
                            updated_at: new Date().toISOString()
                        });
                }
            }

            return response.success(res, data ? data[0] : null, 'Product event logged successfully');
        } catch (err) {
            next(err);
        }
    },

    async getPreferences(req, res, next) {
        try {
            let userId = null;
            const authHeader = req.headers.authorization;
            if (authHeader) {
                const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
                if (token) {
                    try {
                        const { data: { user } } = await supabase.auth.getUser(token);
                        if (user) userId = user.id;
                    } catch (e) {}
                }
            }

            if (!userId) {
                return response.success(res, {
                    skin_type: 'normal',
                    budget: 1500,
                    concerns: [],
                    preferred_brands: [],
                    disliked_ingredients: [],
                    product_interests: []
                });
            }

            const { data, error } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return response.success(res, data || {
                user_id: userId,
                skin_type: 'normal',
                budget: 1500,
                concerns: [],
                preferred_brands: [],
                disliked_ingredients: [],
                product_interests: []
            });
        } catch (err) {
            next(err);
        }
    },

    async updatePreferences(req, res, next) {
        try {
            let userId = null;
            const authHeader = req.headers.authorization;
            if (authHeader) {
                const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
                if (token) {
                    try {
                        const { data: { user } } = await supabase.auth.getUser(token);
                        if (user) userId = user.id;
                    } catch (e) {}
                }
            }

            if (!userId) {
                return response.error(res, 'Authentication required to update preferences', null, 401);
            }

            const { skin_type, budget, concerns, preferred_brands, disliked_ingredients } = req.body;

            const { data, error } = await supabase
                .from('user_preferences')
                .upsert({
                    user_id: userId,
                    skin_type: skin_type || 'normal',
                    budget: budget ? Number(budget) : 1500,
                    concerns: concerns || [],
                    preferred_brands: preferred_brands || [],
                    disliked_ingredients: disliked_ingredients || [],
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            return response.success(res, data, 'Preferences updated successfully');
        } catch (err) {
            next(err);
        }
    }
};
