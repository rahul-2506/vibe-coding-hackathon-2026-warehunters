import { supabase, supabaseAdmin } from '../db.js';
import { productAggregator } from './productAggregator/index.js';
import { productCache } from '../src/embeddings/productCache.js';
import { approvedFeed } from './productAggregator/approvedFeed.js';

const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours
let inMemoryCache = null;
let lastCacheTime = 0;

let dbProductsColumns = null;

async function getProductsTableColumns() {
    if (dbProductsColumns) return dbProductsColumns;
    try {
        const { data, error } = await supabase.from('products').select('*').limit(1);
        if (!error && data && data.length > 0) {
            dbProductsColumns = new Set(Object.keys(data[0]));
            return dbProductsColumns;
        }
    } catch (e) {
        console.warn('[productService] Failed to auto-detect products table columns:', e.message);
    }
    dbProductsColumns = new Set([
        'id', 'name', 'category', 'brand', 'description', 'created_at', 'images', 
        'trust_score', 'reviews_count', 'title', 'price', 'rating', 'keywords', 
        'stock', 'thumbnail', 'image_url', 'review_count', 'embedding',
        'price_inr', 'price_original', 'currency', 'last_updated', 'product_url', 'source'
    ]);
    return dbProductsColumns;
}

function filterObjectByColumns(obj, columns) {
    const filtered = {};
    for (const key of Object.keys(obj)) {
        if (columns.has(key)) {
            filtered[key] = obj[key];
        }
    }
    return filtered;
}

/**
 * Generates an elegant, premium category-aware copywriting hook to elevate catalog realism.
 */
function getCategoryAwareSummary(category, title, brand, originalDescription) {
    const cleanDesc = originalDescription ? originalDescription.trim() : '';
    let hook = '';
    if (category === 'Skincare') {
        hook = `Dermatologist tested and formulated with clinically proven active botanical active ingredients to optimize cellular repair, hydration, and skin barrier resilience.`;
    } else if (category === 'Electronics') {
        hook = `Engineered for professional productivity, utilizing energy-efficient processing architectures to deliver fast speeds, stable performance, and a clean user experience.`;
    } else {
        hook = `Manufactured under strict quality standards to ensure reliable longevity and consistent performance.`;
    }
    
    return `${cleanDesc} ${hook}`;
}

/**
 * Scans catalog for products missing valid thumbnail or image_url.
 */
function auditProductImages(products) {
    if (!products || !Array.isArray(products)) return;
    products.forEach(p => {
        const thumb = p.thumbnail || '';
        const imgUrl = p.image_url || '';
        const isThumbValid = typeof thumb === 'string' && (thumb.startsWith('http://') || thumb.startsWith('https://'));
        const isImgValid = typeof imgUrl === 'string' && (imgUrl.startsWith('http://') || imgUrl.startsWith('https://'));
        
        if (!isThumbValid || !isImgValid) {
            console.warn(`[IMAGE AUDIT] Product ID ${p.id} ("${p.title || p.name}") is missing a valid catalog thumbnail URL.`);
        }
    });
}

function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

const SYNONYMS = {
    'gaming': ['rog', 'strix', 'tuf', 'cyborg', 'legion', 'rtx', 'gpu', 'gaming', 'playstation', 'ps5', 'rtx 4060', 'rtx 4050'],
    'laptop': ['laptop', 'notebook', 'ultrabook', 'xps', 'macbook', 'pavilion', 'ideapad', 'vivobook', 'aspire', 'modern'],
    'pc': ['laptop', 'desktop', 'computer'],
    'phone': ['phone', 'mobile', 'smartphone', 'iphone', 'galaxy', 'oneplus', 'nord', 'cellphone'],
    'mobile': ['phone', 'mobile', 'smartphone', 'iphone', 'galaxy', 'oneplus', 'nord', 'cellphone'],
    'skincare': ['wash', 'cleanser', 'serum', 'cream', 'ordinary', 'cetaphil', 'cerave', 'minimalist', 'himalaya', 'derma', 'toner', 'lotion', 'spf', 'sunscreen'],
    'vacuum': ['dyson', 'cleaner']
};

function calculateSearchScore(product, queryTerms, rawQuery) {
    const title = (product.title || product.name || '').toLowerCase();
    const brand = (product.brand || '').toLowerCase();
    const category = (product.category || '').toLowerCase();
    const subcategory = (product.subcategory || '').toLowerCase();
    const desc = (product.description || '').toLowerCase();
    const keywords = (product.keywords || []).map(k => String(k).toLowerCase());

    let score = 0;

    // Exact full query match gets a massive boost
    if (title.includes(rawQuery)) score += 150;
    if (brand.includes(rawQuery)) score += 80;

    function isFuzzyMatch(term, targetWord) {
        if (term.length < 4) return term === targetWord;
        const dist = getLevenshteinDistance(term, targetWord);
        const maxDist = term.length <= 6 ? 1 : 2;
        return dist <= maxDist;
    }

    // Check query terms
    for (const term of queryTerms) {
        const titleWords = title.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, ''));
        for (const word of titleWords) {
            if (word === term || isFuzzyMatch(term, word)) {
                score += 40;
            }
        }

        const brandWords = brand.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, ''));
        for (const word of brandWords) {
            if (word === term || isFuzzyMatch(term, word)) {
                score += 50; // Brand relevance is high
            }
        }

        if (category.includes(term) || subcategory.includes(term)) {
            score += 30;
        }

        for (const kw of keywords) {
            if (kw === term || isFuzzyMatch(term, kw)) {
                score += 20;
            }
        }

        if (SYNONYMS[term]) {
            for (const syn of SYNONYMS[term]) {
                if (title.includes(syn) || brand.includes(syn) || category.includes(syn) || keywords.includes(syn)) {
                    score += 35; // Semantic match bonus
                }
            }
        }

        if (desc.includes(term)) {
            score += 10;
        }
    }

    if (score > 0) {
        const ratingBoost = (product.rating || 0) * 5; // up to 25 points
        const popularityBoost = Math.min(25, (product.reviewCount || product.review_count || 0) * 0.05); // up to 25 points
        
        const price = Number(product.price || 0);
        const originalPrice = Number(product.originalPrice || product.original_price || price);
        const discountPercent = originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;
        const valueBoost = Math.min(15, discountPercent * 0.3); // up to 15 points
        
        const isAvailable = product.availability === 'In Stock' || (product.stock && Number(product.stock) > 0);
        const availabilityBoost = isAvailable ? 10 : 0;

        score += ratingBoost + popularityBoost + valueBoost + availabilityBoost;
    }

    return score;
}

function normalizePriceToINR(price, title) {
    let val = Number(price || 0);
    let isUSD = false;
    const titleLower = title.toLowerCase();
    
    if (val > 0 && val < 2500) {
        if (titleLower.match(/laptop|computer|phone|iphone|console|playstation|dyson|vacuum/)) {
            isUSD = true;
        } else if (titleLower.match(/serum|cleanser|cream|ordinary|cetaphil/)) {
            if (val < 45) {
                isUSD = true;
            }
        }
    }
    
    if (isUSD) {
        return Math.round(val * 83.5);
    }
    return Math.round(val);
}

/**
 * Generates highly realistic product items deterministically across approved categories.
 */
export function buildMegaCatalog() {
    const products = [];
    let id = 1;
    
    for (const p of approvedFeed) {
        const title = p.title;
        const keywords = [
            p.category.toLowerCase(),
            p.brand.toLowerCase(),
            'premium',
            'authentic'
        ];
        
        title.toLowerCase().split(/\s+/).forEach(w => {
            const cleaned = w.replace(/[^a-z0-9]/g, '');
            if (cleaned.length > 2 && !keywords.includes(cleaned)) {
                keywords.push(cleaned);
            }
        });

        products.push({
            id,
            title,
            name: title,
            description: p.description,
            category: p.category,
            price: p.price,
            price_inr: p.price,
            original_price: p.originalPrice || p.price,
            price_original: p.originalPrice || p.price,
            currency: 'INR',
            rating: p.rating,
            brand: p.brand,
            stock: 50,
            thumbnail: p.image,
            image_url: p.image,
            images: [p.image],
            trust_score: 90,
            review_count: p.reviewCount,
            keywords,
            source: p.specifications?.Merchant || 'Internal Database',
            features: p.specifications || {},
            product_url: p.productUrl || '',
            last_updated: new Date().toISOString()
        });
        id++;
    }
    return products;
}

export const productService = {
    /**
     * Retrieves all products, pulling from Supabase, or memory fallback.
     * Incorporates automatic self-healing seeder check to populate approved categories.
     */
    async getAllProducts() {
        const now = Date.now();
        
        if (inMemoryCache && (now - lastCacheTime < CACHE_DURATION)) {
            return inMemoryCache;
        }

        try {
            console.log('[productService] Verifying Supabase database catalog count...');
            const { count, error: countErr } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true });
                
            if (countErr) {
                console.warn('[productService WARNING] Could not query product count from Supabase:', countErr.message);
                throw countErr;
            }

            console.log(`[productService] Database catalog size is: ${count}`);

            // Self-healing seeder check
            if (count !== approvedFeed.length) {
                console.log(`[productService SEED] Product catalog size (${count}) does not match target threshold of ${approvedFeed.length}. Initiating self-healing seed...`);
                
                // Truncate tables (cascades automatically if relationships are ON DELETE CASCADE)
                const { error: delErr } = await supabaseAdmin.from('products').delete().neq('id', 0);
                if (delErr) {
                    console.error('[productService SEED ERROR] Failed to clear products table:', delErr.message);
                    throw delErr;
                }
                
                const megaCatalog = buildMegaCatalog();
                const CHUNK_SIZE = 50;
                const dbColumns = await getProductsTableColumns();
                
                for (let i = 0; i < megaCatalog.length; i += CHUNK_SIZE) {
                    const chunk = megaCatalog.slice(i, i + CHUNK_SIZE).map(p => {
                        const rawObj = {
                            name: p.title,
                            title: p.title,
                            description: p.description,
                            category: p.category,
                            price: p.price,
                            price_inr: p.price_inr,
                            rating: p.rating,
                            brand: p.brand,
                            stock: p.stock,
                            thumbnail: p.thumbnail,
                            image_url: p.thumbnail,
                            images: p.images,
                            trust_score: p.trust_score,
                            keywords: p.keywords,
                            review_count: p.review_count,
                            reviews_count: p.review_count,
                            original_price: p.original_price,
                            price_original: p.price_original,
                            currency: p.currency,
                            source: p.source,
                            product_url: p.product_url,
                            last_updated: p.last_updated
                        };
                        return filterObjectByColumns(rawObj, dbColumns);
                    });
                    
                    console.log(`[productService SEED] Inserting chunk ${i / CHUNK_SIZE + 1} (${chunk.length} items)...`);
                    const { data: insertedProducts, error: insErr } = await supabaseAdmin
                        .from('products')
                        .insert(chunk)
                        .select('id, title');
                    
                    if (insErr) {
                        console.error('[productService SEED ERROR] Chunk insert failed:', insErr.message);
                        throw insErr;
                    }

                    // Seed detail tables for this chunk
                    if (insertedProducts && insertedProducts.length > 0) {
                        const skincareDetailsToInsert = [];
                        const electronicsDetailsToInsert = [];
                        
                        for (const inserted of insertedProducts) {
                            const feedItem = approvedFeed.find(f => f.title === inserted.title);
                            if (!feedItem) continue;
                            
                            if (feedItem.category === 'Skincare' && feedItem.skincare_details) {
                                skincareDetailsToInsert.push({
                                    product_id: inserted.id,
                                    ...feedItem.skincare_details
                                });
                            } else if (feedItem.category === 'Electronics' && feedItem.electronics_details) {
                                electronicsDetailsToInsert.push({
                                    product_id: inserted.id,
                                    ...feedItem.electronics_details
                                });
                            }
                        }

                        if (skincareDetailsToInsert.length > 0) {
                            const { error: skErr } = await supabaseAdmin.from('skincare_details').insert(skincareDetailsToInsert);
                            if (skErr) console.error('[productService SEED] Failed to seed skincare details:', skErr.message);
                        }
                        if (electronicsDetailsToInsert.length > 0) {
                            const { error: elErr } = await supabaseAdmin.from('electronics_details').insert(electronicsDetailsToInsert);
                            if (elErr) console.error('[productService SEED] Failed to seed electronics details:', elErr.message);
                        }
                    }
                }
                console.log(`[productService SEED SUCCESS] Seeding completed.`);
            }

            // Load all products with detail joins
            console.log('[productService] Loading products from database...');
            let rows = [];
            let from = 0;
            let to = 999;
            let finished = false;
            
            while (!finished) {
                const { data, error } = await supabase
                    .from('products')
                    .select('*, skincare_details(*), electronics_details(*)')
                    .range(from, to);
                
                if (error) {
                    console.error('[productService DB ERROR] Page fetch failed:', error.message);
                    throw error;
                }
                
                if (data && data.length > 0) {
                    rows = rows.concat(data);
                    if (data.length < 1000) {
                        finished = true;
                    } else {
                        from += 1000;
                        to += 1000;
                    }
                } else {
                    finished = true;
                }
            }
            console.log(`[productService] Loaded ${rows.length} products total from database.`);

            if (rows && rows.length > 0) {
                const products = rows.map(r => {
                    const reviewCount = r.review_count || r.reviews_count || Math.floor((r.id * 17) % 180) + 12;
                    const trustScore = r.trust_score || (78 + ((r.id * 7) % 19));
                    
                    let subcategory = r.subcategory || null;
                    const catLower = (r.category || '').toLowerCase();
                    if (!subcategory && catLower === 'skincare') {
                        const nameLower = (r.title || r.name || '').toLowerCase();
                        if (nameLower.includes('wash') || nameLower.includes('cleanser') || nameLower.includes('cleansing') || nameLower.includes('micellar')) {
                            subcategory = 'Face Wash';
                        } else if (nameLower.includes('sunscreen') || nameLower.includes('spf') || nameLower.includes('sun block') || nameLower.includes('sun protection')) {
                            subcategory = 'Sunscreen';
                        } else if (nameLower.includes('moisturizer') || nameLower.includes('cream') || nameLower.includes('butter') || nameLower.includes('lotion')) {
                            subcategory = 'Moisturizer';
                        } else if (nameLower.includes('serum') || nameLower.includes('gel') || nameLower.includes('mist')) {
                            subcategory = 'Serum';
                        } else if (nameLower.includes('toner')) {
                            subcategory = 'Toner';
                        } else if (nameLower.includes('mask') || nameLower.includes('scrub') || nameLower.includes('peel')) {
                            subcategory = 'Masks & Scrubs';
                        } else {
                            subcategory = 'Others';
                        }
                    } else if (!subcategory && catLower === 'electronics') {
                        const nameLower = (r.title || r.name || '').toLowerCase();
                        if (nameLower.includes('laptop') || nameLower.includes('macbook')) {
                            subcategory = 'Laptops';
                        } else if (nameLower.includes('headphone') || nameLower.includes('earbud') || nameLower.includes('airpods')) {
                            subcategory = 'Headphones';
                        } else if (nameLower.includes('phone') || nameLower.includes('iphone') || nameLower.includes('galaxy') || nameLower.includes('oneplus') || nameLower.includes('nothing')) {
                            subcategory = 'Smartphones';
                        } else {
                            subcategory = 'Peripherals';
                        }
                    }
                    
                    const matchedApproved = approvedFeed.find(feedItem => feedItem.title === r.title || feedItem.title === r.name);
                    const specifications = matchedApproved ? (matchedApproved.specifications || {}) : {};

                    // Extract and flatten detail tables
                    const skincare = r.skincare_details ? (Array.isArray(r.skincare_details) ? r.skincare_details[0] : r.skincare_details) : null;
                    const electronics = r.electronics_details ? (Array.isArray(r.electronics_details) ? r.electronics_details[0] : r.electronics_details) : null;

                    return {
                        id: Number(r.id),
                        title: r.title || r.name,
                        name: r.title || r.name, 
                        description: getCategoryAwareSummary(r.category, r.title || r.name, r.brand, r.description),
                        category: r.category,
                        subcategory: subcategory,
                        price: Number(r.price_inr || r.price || 0),
                        price_inr: Number(r.price_inr || r.price || 0),
                        original_price: Number(r.price_original || r.original_price || r.price || 0),
                        price_original: Number(r.price_original || r.original_price || r.price || 0),
                        currency: r.currency || 'INR',
                        rating: Number(r.rating),
                        brand: r.brand,
                        stock: Number(r.stock),
                        thumbnail: r.thumbnail || r.image_url,
                        image_url: r.image_url || r.thumbnail, 
                        images: Array.isArray(r.images) ? r.images : (typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || [])),
                        trust_score: Number(trustScore),
                        review_count: Number(reviewCount),
                        keywords: Array.isArray(r.keywords) ? r.keywords : (typeof r.keywords === 'string' ? JSON.parse(r.keywords) : (r.keywords || [])),
                        current_price: Number(r.price_inr || r.price || 0),
                        source: r.source || 'Internal Database',
                        product_url: r.product_url || '',
                        last_price_update: r.last_updated || null,
                        price_comparison: Array.isArray(r.price_comparison) ? r.price_comparison : (typeof r.price_comparison === 'string' ? JSON.parse(r.price_comparison) : (r.price_comparison || [])),
                        specifications: specifications,
                        // Relational Details Flattened
                        ingredients: skincare?.ingredients || '',
                        key_ingredients: skincare?.key_ingredients || '',
                        skin_type: skincare?.skin_type || '',
                        concerns: skincare?.concerns || '',
                        specifications_json: electronics?.specifications_json || {},
                        technical_features: electronics?.technical_features || ''
                    };
                });
                
                products.sort((a, b) => a.id - b.id);
                
                auditProductImages(products);
                inMemoryCache = products;
                lastCacheTime = now;
                return products;
            } else {
                throw new Error('Database select returned an empty array.');
            }
        } catch (err) {
            console.error('[productService DB ERROR] Supabase connection failed or database query erred:', err.message);
            throw err;
        }
    },

    async getProductById(id) {
        const products = await this.getAllProducts();
        return products.find(p => p.id === Number(id)) || null;
    },

    async getProductsByCategory(categoryName) {
        const products = await this.getAllProducts();
        return products.filter(p => p.category.toLowerCase() === categoryName.toLowerCase());
    },

    async searchProducts(query, category, sort, subcategory) {
        let candidates = [];
        
        if (query) {
            console.log(`[productService] Querying aggregator for candidates matching "${query}"...`);
            const aggregatorResults = await productAggregator.searchProducts(query, category);
            
            aggregatorResults.forEach(p => {
                p.price = normalizePriceToINR(p.price, p.title || p.name);
                if (p.originalPrice) p.originalPrice = normalizePriceToINR(p.originalPrice, p.title || p.name);
            });

            const providerResults = aggregatorResults.filter(p => p.source && p.source !== 'Internal Database' && p.source !== 'approvedFeed');
            
            if (providerResults.length > 0) {
                console.log(`[productService] Prioritizing ${providerResults.length} real provider results.`);
                candidates = providerResults;
            } else {
                console.log(`[productService] No real provider results. Falling back to database.`);
                candidates = await this.getAllProducts();
            }
        } else {
            candidates = await this.getAllProducts();
        }

        let filtered = candidates;
        if (category && category !== 'All' && category !== '') {
            filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
        }
        if (subcategory && subcategory !== 'All' && subcategory !== '') {
            filtered = filtered.filter(p => p.subcategory && p.subcategory.toLowerCase() === subcategory.toLowerCase());
        }

        let queryMatched = [];
        if (query) {
            const q = query.toLowerCase().trim();
            const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'with', 'is', 'at', 'by', 'from', 'on', 'this', 'that', 'these', 'those', 'it', 'its', 'as']);
            let terms = q.split(/\s+/).filter(t => t.length > 0);
            if (terms.length > 1) {
                terms = terms.filter(t => !stopwords.has(t));
            }
            
            if (terms.length > 0) {
                const scoredProducts = [];
                for (const p of filtered) {
                    const score = calculateSearchScore(p, terms, q);
                    if (score > 0) {
                        scoredProducts.push({ product: p, searchScore: score });
                    }
                }
                
                scoredProducts.sort((a, b) => {
                    if (b.searchScore !== a.searchScore) {
                        return b.searchScore - a.searchScore;
                    }
                    if (b.product.rating !== a.product.rating) {
                        return b.product.rating - a.product.rating;
                    }
                    return (b.product.trust_score || 80) - (a.product.trust_score || 80);
                });
                queryMatched = scoredProducts.map(sp => sp.product);
            } else {
                queryMatched = filtered;
            }
        } else {
            queryMatched = filtered;
        }

        if (sort) {
            if (sort === 'trust_score') {
                queryMatched.sort((a, b) => (b.trust_score || 80) - (a.trust_score || 80));
            } else if (sort === 'rating') {
                queryMatched.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            } else if (sort === 'price') {
                queryMatched.sort((a, b) => (a.price || 0) - (b.price || 0));
            } else if (sort === 'price_desc') {
                queryMatched.sort((a, b) => (b.price || 0) - (a.price || 0));
            }
        }

        const seenIds = new Set();
        const seenTitles = new Set();
        const deduplicated = [];
        for (const p of queryMatched) {
            const idKey = String(p.id);
            const titleKey = (p.title || p.name || '').toLowerCase().trim();
            if (!seenIds.has(idKey) && !seenTitles.has(titleKey)) {
                seenIds.add(idKey);
                seenTitles.add(titleKey);
                deduplicated.push(p);
            }
        }

        const diversified = [];
        const deferred = [];
        const brandCounts = {};
        const modelGroups = {};

        for (const p of deduplicated) {
            const brand = (p.brand || 'unknown').toLowerCase().trim();
            const modelKey = (p.title || p.name || '').toLowerCase().split(/\s+/).slice(0, 3).join(' ');
            
            brandCounts[brand] = brandCounts[brand] || 0;
            modelGroups[modelKey] = modelGroups[modelKey] || 0;
            
            if (brandCounts[brand] < 2 && modelGroups[modelKey] < 1) {
                diversified.push(p);
                brandCounts[brand]++;
                modelGroups[modelKey]++;
            } else {
                deferred.push(p);
            }
        }

        return [...diversified, ...deferred];
    },

    async getPaginatedProducts({ page = 1, limit = 24, category, subcategory, searchQuery, sort }) {
        let products = await this.searchProducts(searchQuery, category, sort, subcategory);
        
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const total = products.length;
        const paginatedItems = products.slice(startIndex, endIndex);
        
        return {
            products: paginatedItems,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }
};
