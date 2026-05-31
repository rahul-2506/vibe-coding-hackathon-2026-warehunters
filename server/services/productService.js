import { supabase } from '../db.js';

const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours
let inMemoryCache = null;
let lastCacheTime = 0;

// Curated high-resolution Unsplash product image URLs for each category (8 per category)
const UNSPLASH_IMAGES = {
    'Skincare & Beauty': [
        'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1617897903246-719242758050?w=600&auto=format&fit=crop'
    ],
    'Electronics': [
        'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1572569511254-d8f925fe7cbb?w=600&auto=format&fit=crop'
    ],
    'Groceries': [
        'https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1607349913338-fca6f7fc42d0?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1610832958506-ee5633613044?w=600&auto=format&fit=crop'
    ],
    'Home & Living': [
        'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=600&auto=format&fit=crop'
    ],
    'Fashion & Apparel': [
        'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&auto=format&fit=crop'
    ],
    'Others': [
        'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1512418490979-91795d4389a3?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1581557991964-125469da3b8a?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1575844712292-74142a770947?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop'
    ]
};

const CATEGORY_DETAILS = {
    'Skincare & Beauty': {
        brands: ['Luminis', 'DermaGlow', 'Aura Botanicals', 'Soma Skin', 'Verdant', 'Restora', 'Aether Beauty', 'Nuance', 'Solace', 'Epicurean'],
        adjectives: ['Hydrating', 'Revitalizing', 'Clarifying', 'Anti-Aging', 'Nourishing', 'Soothing', 'Brightening', 'Firming', 'Balancing', 'Renewing', 'Exfoliating', 'Purifying', 'Active', 'Calming', 'Intense'],
        nouns: ['Serum', 'Facewash', 'Moisturizer', 'Cleansing Oil', 'Toner', 'Night Cream', 'Eye Gel', 'Clay Mask', 'Sunscreen SPF 50', 'Lip Balm', 'Body Butter', 'Peel Off Mask', 'Micellar Water', 'Face Scrub', 'Hydrosol Mist'],
        modifiers: ['50ml', '100ml', '150ml', '200ml', '30g', '50g', '15g'],
        images: UNSPLASH_IMAGES['Skincare & Beauty']
    },
    'Electronics': {
        brands: ['Quantum', 'CyberRig', 'VoltEdge', 'Apex', 'AeroTek', 'Synapse', 'OmniTech', 'Stratus', 'Nova', 'Infinity'],
        adjectives: ['Wireless', 'Ultra-Slim', 'Pro-Series', 'Noise-Cancelling', 'High-Speed', 'Portable', 'Smart', 'HD', 'Ergonomic', 'Mechanical', 'Bluetooth', 'Multi-Device', 'Rechargeable', 'Precision', 'Compact'],
        nouns: ['Headphones', 'Laptop', 'Smartwatch', 'Earbuds', 'Keyboard', 'Mouse', 'Monitor', 'Charger', 'Speaker', 'Tablet', 'Webcam', 'Microphone', 'Router', 'Power Bank', 'SSD Drive'],
        modifiers: ['Pro', 'Ultra', 'Elite', 'Max', 'Plus', 'V2', 'X100', 'Gen 5'],
        images: UNSPLASH_IMAGES['Electronics']
    },
    'Groceries': {
        brands: ['NatureBrew', 'HarvestGold', 'PureOrigin', 'Sustaina', 'VibrantLife', 'EarthsBest', 'FarmFresh', 'GoldenGrains', 'SimplyOrganic', 'OrchardFresh'],
        adjectives: ['Organic', 'Sustainably Sourced', 'Pure', 'Natural', 'Premium', 'Whole Wheat', 'Gluten-Free', 'Cold-Pressed', 'Raw', 'Artisanal', 'Salted', 'Roasted', 'Sweet', 'Mild', 'Rich'],
        nouns: ['Green Tea Pack', 'Honey Jar', 'Granola Oats', 'Olive Oil', 'Almond Milk', 'Dark Chocolate', 'Gourmet Coffee', 'Chia Seeds', 'Cashew Nuts', 'Apple Cider Vinegar', 'Maple Syrup', 'Basmati Rice', 'Sea Salt', 'Fruit Jam', 'Peanut Butter'],
        modifiers: ['500g', '1kg', '250g', '750ml', '500ml', '12-Pack', 'Single Pack'],
        images: UNSPLASH_IMAGES['Groceries']
    },
    'Home & Living': {
        brands: ['RusticWood', 'Minimalis', 'Cozydom', 'Moderna', 'Haven', 'LuxeLoom', 'AuraDecor', 'Terra', 'Elysian', 'NordicSpace'],
        adjectives: ['Minimalist', 'Ergonomic', 'Handcrafted', 'Solid Wood', 'Elegant', 'Modern', 'Cozy', 'Compact', 'Adjustable', 'Breathable', 'Sleek', 'Decorative', 'Geometric', 'Plush', 'Rustic'],
        nouns: ['Dining Table', 'Sofa Chair', 'Floor Lamp', 'Coffee Table', 'Drawer Chest', 'Bed Linen Set', 'Dining Set', 'Wall Shelf', 'Desk Organizer', 'Throw Pillow', 'Area Rug', 'Scented Candle', 'Ceramic Vase', 'Desk Chair', 'Curtain Panel'],
        modifiers: ['Standard', 'Large', 'Deluxe', 'Set of 2', 'Classic', 'Premium Edition'],
        images: UNSPLASH_IMAGES['Home & Living']
    },
    'Fashion & Apparel': {
        brands: ['Veloce', 'AeroWear', 'Loom & Thread', 'StitchCraft', 'Nomad', 'EverFit', 'ClassicFit', 'Breeze', 'Silhouette', 'Echo'],
        adjectives: ['Classic', 'Breathable', 'Weatherproof', 'Tailored', 'Stretch', 'Lightweight', 'Heavyweight', 'Soft-Touch', 'Casual', 'Sporty', 'Formal', 'Seamless', 'Windproof', 'Cozy', 'Slim-Fit'],
        nouns: ['Trench Coat', 'Summer T-Shirt', 'Leather Jacket', 'Running Shoes', 'Leather Handbag', 'White Sneakers', 'Active Joggers', 'Cotton Hoodie', 'Denim Jeans', 'Chino Pants', 'Wool Sweater', 'Socks Set', 'Polo Shirt', 'Duffle Bag', 'Beanie Hat'],
        modifiers: ['S', 'M', 'L', 'XL', 'Unisex', 'One Size', 'Pack of 3'],
        images: UNSPLASH_IMAGES['Fashion & Apparel']
    },
    'Others': {
        brands: ['Veritas', 'Pinnacle', 'ApexLine', 'Solari', 'Omni', 'Vanguard', 'Genesis', 'Atlas', 'NovaPet', 'Zenith'],
        adjectives: ['Professional', 'Premium', 'Eco-Friendly', 'Heavy-Duty', 'Compact', 'Multipurpose', 'Travel-Ready', 'Aesthetic', 'Ergonomic', 'Creative', 'Waterproof', 'Deluxe', 'Smart', 'Luxury', 'Advanced'],
        nouns: ['Hardcover Journal', 'Rollerball Pen', 'Yoga Mat', 'Pet Shampoo', 'Travel Luggage', 'Toy Plane Model', 'Desk Fountain', 'Card Holder', 'Resistance Bands', 'Insulated Flask', 'Dog Collar', 'Umbrella', 'Toolkit', 'Board Game', 'Planner'],
        modifiers: ['Edition 2026', 'Set', 'Solo', 'Travel Pack', 'Pro Version', 'v4.0'],
        images: UNSPLASH_IMAGES['Others']
    }
};

/**
 * Generates custom keywords for a product based on its fields.
 */
function generateKeywords(product) {
    const text = `${product.title} ${product.description} ${product.category} ${product.brand || ''}`.toLowerCase();
    const words = text.match(/\b[a-z]{3,}\b/g) || [];
    const stopwords = new Set([
        'and', 'the', 'with', 'for', 'this', 'that', 'from', 'your', 'skin', 'popular', 'known', 'knowning', 'contains', 'derived'
    ]);
    const unique = [...new Set(words.filter(w => !stopwords.has(w)))];
    return unique.slice(0, 8); // top 8 unique keywords
}

/**
 * Generates an elegant, premium category-aware copywriting hook to elevate catalog realism.
 */
function getCategoryAwareSummary(category, title, brand, originalDescription) {
    const cleanDesc = originalDescription ? originalDescription.trim() : '';
    let hook = '';
    if (category === 'Skincare & Beauty') {
        hook = `Dermatologist tested and formulated with clinically proven active botanical extracts to optimize cellular repair and structural elasticity.`;
    } else if (category === 'Electronics') {
        hook = `Engineered for professional productivity, utilizing energy-efficient processing architectures to deliver fast speeds and a clean user experience.`;
    } else if (category === 'Groceries') {
        hook = `100% natural and sustainably sourced. Expertly harvested at peak freshness to retain core vitamins and authentic rich flavor.`;
    } else if (category === 'Home & Living') {
        hook = `Features highly durable structural reinforcement and a balanced modern minimalist shape, perfect for premium room layouts.`;
    } else if (category === 'Fashion & Apparel') {
        hook = `Tailored with reinforced double stitching and hyper-breathable smart fibers, ensuring a lasting and comfortable fit.`;
    } else {
        hook = `Manufactured under strict ISO quality standards to ensure reliable longevity and consistent performance.`;
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

/**
 * Generates 1020 highly realistic product items deterministically across 6 categories.
 */
export function buildMegaCatalog() {
    const products = [];
    let id = 1;
    const categories = Object.keys(CATEGORY_DETAILS);
    
    for (const category of categories) {
        const details = CATEGORY_DETAILS[category];
        for (let i = 0; i < 170; i++) {
            const brand = details.brands[i % details.brands.length];
            const adj = details.adjectives[i % details.adjectives.length];
            // Cycle through nouns using index offset to maximize variety
            const noun = details.nouns[(i + Math.floor(i / 15)) % details.nouns.length];
            const mod = details.modifiers[i % details.modifiers.length];
            
            const title = `${brand} ${adj} ${noun} (${mod})`;
            
            let basePrice = 15;
            if (category === 'Electronics') basePrice = 299;
            else if (category === 'Home & Living') basePrice = 150;
            else if (category === 'Fashion & Apparel') basePrice = 65;
            else if (category === 'Groceries') basePrice = 12;
            
            const price = parseFloat((basePrice + ((i * 13) % 87) + 0.99).toFixed(2));
            const rating = parseFloat((4.0 + ((i * 3) % 11) / 10).toFixed(1));
            const trustScore = 75 + ((i * 7) % 21);
            const reviewCount = 20 + ((i * 17) % 180);
            const stock = 10 + ((i * 5) % 90);
            
            const thumbnail = details.images[i % details.images.length];
            const images = [thumbnail];
            
            const cleanDesc = `A premium quality ${adj.toLowerCase()} ${noun.toLowerCase()} designed by ${brand} to elevate your lifestyle. Crafted with attention to detail and standard-setting components.`;
            const description = getCategoryAwareSummary(category, title, brand, cleanDesc);
            
            const keywords = [
                category.split(' ')[0].toLowerCase(), 
                brand.toLowerCase(), 
                adj.toLowerCase(), 
                noun.toLowerCase(), 
                'premium', 
                'highquality'
            ];
            
            products.push({
                id,
                title,
                name: title, // Map to name for frontend component matching
                description,
                category,
                price,
                rating,
                brand,
                stock,
                thumbnail,
                image_url: thumbnail, // Map to image_url for frontend card rendering
                images,
                trust_score: trustScore,
                review_count: reviewCount,
                keywords
            });
            id++;
        }
    }
    return products;
}

export const productService = {
    /**
     * Retrieves all products, pulling from Supabase, or memory fallback.
     * Incorporates automatic self-healing seeder check to populate 1020 products if empty.
     */
    async getAllProducts() {
        const now = Date.now();
        
        // 1. Return memory cache if valid
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

            // 2. Self-healing check: if count < 1000, trigger automated seed!
            if (count < 1000) {
                console.log(`[productService SEED] Product catalog size (${count}) is below target threshold of 1000. Initiating self-healing seed of 1020 premium products...`);
                
                // Clear existing records to ensure catalog consistency
                const { error: delErr } = await supabase.from('products').delete().neq('id', 0);
                if (delErr) {
                    console.error('[productService SEED ERROR] Failed to clear products table:', delErr.message);
                    throw delErr;
                }
                
                // Generate and batch-insert
                const megaCatalog = buildMegaCatalog();
                const CHUNK_SIZE = 200;
                
                try {
                    for (let i = 0; i < megaCatalog.length; i += CHUNK_SIZE) {
                        const chunk = megaCatalog.slice(i, i + CHUNK_SIZE).map(p => ({
                            title: p.title,
                            description: p.description,
                            category: p.category,
                            price: p.price,
                            rating: p.rating,
                            brand: p.brand,
                            stock: p.stock,
                            thumbnail: p.thumbnail,
                            images: p.images,
                            trust_score: p.trust_score,
                            keywords: p.keywords
                        }));
                        
                        console.log(`[productService SEED] Inserting chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(megaCatalog.length / CHUNK_SIZE)} (${chunk.length} items)...`);
                        const { error: insErr } = await supabase.from('products').insert(chunk);
                        if (insErr) {
                            throw insErr;
                        }
                    }
                    console.log('[productService SEED SUCCESS] 1020 products successfully seeded to Supabase (with keywords).');
                } catch (seedErr) {
                    console.warn(`[productService SEED WARNING] Seeding failed with error: ${seedErr.message}. Retrying without 'keywords' column...`);
                    
                    // Clear products table again to start clean
                    await supabase.from('products').delete().neq('id', 0);
                    
                    for (let i = 0; i < megaCatalog.length; i += CHUNK_SIZE) {
                        const chunk = megaCatalog.slice(i, i + CHUNK_SIZE).map(p => ({
                            title: p.title,
                            description: p.description,
                            category: p.category,
                            price: p.price,
                            rating: p.rating,
                            brand: p.brand,
                            stock: p.stock,
                            thumbnail: p.thumbnail,
                            images: p.images,
                            trust_score: p.trust_score
                        }));
                        
                        console.log(`[productService SEED RETRY] Inserting chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(megaCatalog.length / CHUNK_SIZE)} (${chunk.length} items without keywords)...`);
                        const { error: insErr } = await supabase.from('products').insert(chunk);
                        if (insErr) {
                            console.error('[productService SEED ERROR] Seeding without keywords failed:', insErr.message);
                            throw insErr;
                        }
                    }
                    console.log('[productService SEED SUCCESS] 1020 products successfully seeded to Supabase (without keywords).');
                }
            }

            // 3. Load full catalog from Supabase
            console.log('[productService] Loading products from Supabase database...');
            const { data: rows, error: selErr } = await supabase
                .from('products')
                .select('*')
                .range(0, 1500); // Bypass standard 1000 row limits
                
            if (selErr) {
                throw selErr;
            }

            if (rows && rows.length > 0) {
                const products = rows.map(r => {
                    const reviewCount = Math.floor((r.id * 17) % 180) + 12;
                    const trustScore = r.trust_score || (78 + ((r.id * 7) % 19));
                    
                    return {
                        id: Number(r.id),
                        title: r.title,
                        name: r.title, // frontend compatibility
                        description: r.description,
                        category: r.category,
                        price: Number(r.price),
                        rating: Number(r.rating),
                        brand: r.brand,
                        stock: Number(r.stock),
                        thumbnail: r.thumbnail,
                        image_url: r.thumbnail, // frontend compatibility
                        images: Array.isArray(r.images) ? r.images : (typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || [])),
                        trust_score: Number(trustScore),
                        review_count: Number(reviewCount),
                        keywords: Array.isArray(r.keywords) ? r.keywords : (typeof r.keywords === 'string' ? JSON.parse(r.keywords) : (r.keywords || []))
                    };
                });
                
                products.sort((a, b) => a.id - b.id); // Stabilize sorting order
                
                auditProductImages(products);
                inMemoryCache = products;
                lastCacheTime = now;
                return products;
            } else {
                throw new Error('Database select returned an empty array.');
            }
        } catch (err) {
            console.warn('[productService DB WARNING] Supabase connection failed or database is unpopulated. Falling back to high-fidelity memory catalog.', err.message);
            // Standby memory fallback
            const megaCatalog = buildMegaCatalog();
            inMemoryCache = megaCatalog;
            lastCacheTime = now;
            return megaCatalog;
        }
    },

    /**
     * Retrieves a single product by ID.
     */
    async getProductById(id) {
        const products = await this.getAllProducts();
        return products.find(p => p.id === Number(id)) || null;
    },

    /**
     * Retrieves products filtered by category.
     */
    async getProductsByCategory(categoryName) {
        const products = await this.getAllProducts();
        return products.filter(p => p.category.toLowerCase() === categoryName.toLowerCase());
    },

    /**
     * Upgraded High-Relevance Weighted Multi-Term Search Engine
     */
    async searchProducts(query, category, sort) {
        let products = await this.getAllProducts();
        
        // 1. Text Search matching with weighted relevance scoring
        if (query) {
            const q = query.toLowerCase().trim();
            const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'with', 'is', 'at', 'by', 'from', 'on', 'this', 'that', 'these', 'those', 'it', 'its', 'as']);
            // Tokenize and filter out common stopwords unless they are the entire query
            let terms = q.split(/\s+/).filter(t => t.length > 0);
            if (terms.length > 1) {
                terms = terms.filter(t => !stopwords.has(t));
            }
            
            if (terms.length > 0) {
                const scoredProducts = [];
                for (const p of products) {
                    let score = 0;
                    const title = (p.title || '').toLowerCase();
                    const desc = (p.description || '').toLowerCase();
                    const cat = (p.category || '').toLowerCase();
                    const brand = (p.brand || '').toLowerCase();
                    const keywords = Array.isArray(p.keywords) ? p.keywords : [];

                    // Exact phrase match bonuses
                    if (title.includes(q)) score += 100;
                    else if (desc.includes(q)) score += 40;
                    
                    // Term-by-term matching
                    for (const term of terms) {
                        const isShort = term.length < 3;
                        
                        // Title matches
                        if (isShort ? new RegExp('\\b' + term + '\\b').test(title) : title.includes(term)) {
                            score += 30;
                            // Word boundary bonus
                            if (new RegExp('\\b' + term + '\\b').test(title)) {
                                score += 20;
                            }
                        }
                        // Brand matches
                        if (brand && (isShort ? new RegExp('\\b' + term + '\\b').test(brand) : brand.includes(term))) {
                            score += 25;
                            if (new RegExp('\\b' + term + '\\b').test(brand)) {
                                score += 15;
                            }
                        }
                        // Category matches
                        if (isShort ? new RegExp('\\b' + term + '\\b').test(cat) : cat.includes(term)) {
                            score += 20;
                        }
                        // Keyword matches
                        if (keywords.some(kw => isShort ? new RegExp('\\b' + term + '\\b').test(String(kw).toLowerCase()) : String(kw).toLowerCase().includes(term))) {
                            score += 15;
                        }
                        // Description matches
                        if (isShort ? new RegExp('\\b' + term + '\\b').test(desc) : desc.includes(term)) {
                            score += 10;
                            if (new RegExp('\\b' + term + '\\b').test(desc)) {
                                score += 5;
                            }
                        }
                    }

                    if (score > 0) {
                        scoredProducts.push({ product: p, searchScore: score });
                    }
                }

                // Apply category filtering to the matched list if requested
                let filteredScored = scoredProducts;
                if (category && category !== 'All' && category !== '') {
                    filteredScored = scoredProducts.filter(sp => sp.product.category.toLowerCase() === category.toLowerCase());
                }

                // Apply sorting
                if (sort) {
                    const sortedProducts = filteredScored.map(sp => sp.product);
                    if (sort === 'trust_score') {
                        sortedProducts.sort((a, b) => (b.trust_score || 80) - (a.trust_score || 80));
                    } else if (sort === 'rating') {
                        sortedProducts.sort((a, b) => b.rating - a.rating);
                    } else if (sort === 'price') {
                        sortedProducts.sort((a, b) => a.price - b.price);
                    } else if (sort === 'price_desc') {
                        sortedProducts.sort((a, b) => b.price - a.price);
                    }
                    products = sortedProducts;
                } else {
                    // Default: Sort by relevance score descending
                    filteredScored.sort((a, b) => {
                        if (b.searchScore !== a.searchScore) {
                            return b.searchScore - a.searchScore;
                        }
                        // Secondary tie-breaker: Rating
                        if (b.product.rating !== a.product.rating) {
                            return b.product.rating - a.product.rating;
                        }
                        // Tertiary tie-breaker: Trust score
                        return (b.product.trust_score || 80) - (a.product.trust_score || 80);
                    });
                    products = filteredScored.map(sp => sp.product);
                }
            } else {
                // If query is only whitespace
                if (category && category !== 'All' && category !== '') {
                    products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
                }
            }
        } else {
            // No search query: standard category filter and sorting
            if (category && category !== 'All' && category !== '') {
                products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
            }

            if (sort) {
                if (sort === 'trust_score') {
                    products.sort((a, b) => (b.trust_score || 80) - (a.trust_score || 80));
                } else if (sort === 'rating') {
                    products.sort((a, b) => b.rating - a.rating);
                } else if (sort === 'price') {
                    products.sort((a, b) => a.price - b.price);
                } else if (sort === 'price_desc') {
                    products.sort((a, b) => b.price - a.price);
                }
            }
        }

        return products;
    },

    /**
     * Supports paginated product queries.
     */
    async getPaginatedProducts({ page = 1, limit = 24, category, searchQuery, sort }) {
        let products = await this.searchProducts(searchQuery, category, sort);
        
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
