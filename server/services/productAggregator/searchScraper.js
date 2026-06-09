import fetch from 'node-fetch';
import { logger } from '../../utils/logger.js';
import { approvedFeed } from './approvedFeed.js';

// Curated high-res images to associate with categories to avoid placeholders
const CATEGORY_IMAGES = {
    'Skincare & Beauty': [
        'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop'
    ],
    'Electronics': [
        'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop'
    ],
    'Groceries': [
        'https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1607349913338-fca6f7fc42d0?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop'
    ],
    'Home & Living': [
        'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&auto=format&fit=crop'
    ],
    'Fashion & Apparel': [
        'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&auto=format&fit=crop'
    ],
    'Others': [
        'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=600&auto=format&fit=crop'
    ]
};

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

export const searchScraper = {
    async scrapeMerchant(siteDomain, query, categoryName = 'Others') {
        logger.info(`[SCRAPER] Querying DuckDuckGo live search for: "${query}" on site "${siteDomain}"`, 'AGGREGATOR_SCRAPER');
        try {
            const url = `https://html.duckduckgo.com/html/?q=site:${siteDomain}+${encodeURIComponent(query)}`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
                }
            });
            if (response.ok) {
                const html = await response.text();
                const results = this.parseDDGHtml(html, siteDomain, categoryName);
                if (results && results.length > 0) {
                    logger.info(`[SCRAPER] DuckDuckGo live search returned ${results.length} results for "${query}" on site "${siteDomain}"`, 'AGGREGATOR_SCRAPER');
                    return results;
                }
            }
        } catch (e) {
            logger.error(`[SCRAPER ERROR] DuckDuckGo query failed: ${e.message}`, 'AGGREGATOR_SCRAPER');
        }
        
        logger.info(`[SCRAPER] Falling back to local approved feed for: "${query}" under domain "${siteDomain}"`, 'AGGREGATOR_SCRAPER');
        return this.getApprovedFeedFallback(siteDomain, query, categoryName);
    },

    getApprovedFeedFallback(siteDomain, query, categoryName) {
        if (!query) return [];
        const cleanQ = cleanQueryForMatching(query);
        const queryLower = cleanQ.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
        
        let matched = approvedFeed;
        if (queryWords.length > 0) {
            matched = approvedFeed.filter(p => {
                const title = (p.title || '').toLowerCase();
                const brand = (p.brand || '').toLowerCase();
                const cat = (p.category || '').toLowerCase();
                const desc = (p.description || '').toLowerCase();
                
                return queryWords.every(word => 
                    title.includes(word) || 
                    brand.includes(word) || 
                    cat.includes(word) || 
                    desc.includes(word)
                );
            });

            if (matched.length === 0) {
                // Relaxed match
                matched = approvedFeed.filter(p => {
                    const title = (p.title || '').toLowerCase();
                    const brand = (p.brand || '').toLowerCase();
                    return queryWords.some(word => title.includes(word) || brand.includes(word));
                });
            }
        }

        // Map domains to standard provider names and allowed categories
        const domainMap = {
            'amazon.in': { name: 'Amazon', categories: ['Electronics', 'Skincare & Beauty', 'Groceries', 'Home & Living', 'Fashion & Apparel', 'Others'] },
            'flipkart.com': { name: 'Flipkart', categories: ['Electronics', 'Skincare & Beauty', 'Groceries', 'Home & Living', 'Fashion & Apparel', 'Others'] },
            'myntra.com': { name: 'Myntra', categories: ['Fashion & Apparel', 'Skincare & Beauty'] },
            'nykaa.com': { name: 'Nykaa', categories: ['Skincare & Beauty'] },
            'ajio.com': { name: 'Ajio', categories: ['Fashion & Apparel'] },
            'croma.com': { name: 'Croma', categories: ['Electronics', 'Home & Living'] },
            'reliancedigital.in': { name: 'Reliance Digital', categories: ['Electronics', 'Home & Living'] }
        };
        const config = domainMap[siteDomain] || { name: 'Generic', categories: [] };
        const sourceName = config.name;

        if (config.categories.length > 0) {
            matched = matched.filter(p => config.categories.includes(p.category));
        }

        return matched.map((p, idx) => {
            let productUrl = p.productUrl || '';
            if (!productUrl.includes(siteDomain)) {
                productUrl = `https://www.${siteDomain}/search?q=${encodeURIComponent(p.title)}`;
            }
            return {
                id: `scraped-${siteDomain}-${idx}-${Date.now()}`,
                title: p.title,
                brand: p.brand,
                category: p.category || categoryName,
                image: p.image,
                price: Number(p.price || 0),
                originalPrice: Number(p.originalPrice || p.price || 0),
                rating: p.rating,
                reviewCount: p.reviewCount || 0,
                availability: p.availability || 'In Stock',
                productUrl: productUrl,
                specifications: {
                    ...p.specifications,
                    Merchant: sourceName
                }
            };
        });
    },

    parseDDGHtml(html, siteDomain, categoryName) {
        const results = [];
        
        // Match results block using regex
        const resultRegex = /<div class="result results_links results_links_deep[^"]*"[\s\S]*?<a class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
        
        let match;
        let index = 0;
        
        while ((match = resultRegex.exec(html)) !== null && index < 5) {
            let link = match[1];
            let rawTitle = match[2];
            let rawSnippet = match[3];

            // Clean title and snippet tags
            const title = rawTitle.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            const snippet = rawSnippet.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

            // Decode links if routed through DuckDuckGo redirect
            if (link.includes('uddg=')) {
                try {
                    const parsedUrl = new URL(link);
                    const uddg = parsedUrl.searchParams.get('uddg');
                    if (uddg) link = uddg;
                } catch (e) {}
            }

            // Extract price from snippet and normalize to INR
            let price = 0;
            let originalPrice = 0;
            const priceRegex = /(Rs\.?|INR|₹|\$)\s?(\d+(?:,\d+)*(?:\.\d+)?)/i;
            const priceMatch = snippet.match(priceRegex);
            if (priceMatch) {
                const symbol = priceMatch[1];
                let val = parseFloat(priceMatch[2].replace(/,/g, ''));
                if (symbol === '$' || (val > 0 && val < 2500 && title.toLowerCase().match(/laptop|computer|phone|iphone|console|dyson/))) {
                    val = Math.round(val * 83.5);
                }
                price = val;
                originalPrice = parseFloat((price * 1.15).toFixed(2)); // Default discount simulation
            } else {
                // Heuristic backup price
                price = parseFloat((150 + (title.length * 7) % 850).toFixed(2));
                const titleLower = title.toLowerCase();
                if (titleLower.match(/laptop|macbook/)) {
                    price = 45000 + (title.length * 237) % 35000;
                } else if (titleLower.match(/phone|iphone|galaxy/)) {
                    price = 15000 + (title.length * 197) % 25000;
                }
                originalPrice = parseFloat((price * 1.2).toFixed(2));
            }

            // Extract brand
            let brand = 'Generic';
            const brandsList = ['acer', 'asus', 'hp', 'dell', 'lenovo', 'apple', 'samsung', 'sony', 'logitech', 'razer', 'himalaya', 'derma co', 'mamaearth', 'minimalist', 'the ordinary', 'cetaphil', 'cerave', 'nike', 'adidas', 'zara', 'uniqlo', 'levis', 'lg', 'philips', 'reliance', 'nykaa', 'myntra', 'ajio', 'croma'];
            for (const b of brandsList) {
                if (title.toLowerCase().includes(b)) {
                    brand = b.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    break;
                }
            }

            // Category detection fallback
            let category = categoryName;
            const titleLower = title.toLowerCase();
            if (titleLower.match(/laptop|computer|phone|camera|keyboard|monitor|cpu|gpu|ram|charger|headphone|mouse|electronics|tv|speaker/)) {
                category = 'Electronics';
            } else if (titleLower.match(/milk|bread|apple|coffee|tea|chocolate|groceries|egg|rice|sugar|snack|fruit|vegetable/)) {
                category = 'Groceries';
            } else if (titleLower.match(/shirt|jeans|shoes|jacket|dress|bag|fashion|socks|hat|watch|apparel/)) {
                category = 'Fashion & Apparel';
            } else if (titleLower.match(/chair|table|lamp|sofa|bed|pillow|decor|furniture|kitchen|dining/)) {
                category = 'Home & Living';
            } else if (titleLower.match(/serum|facewash|cream|moisturizer|scrub|toner|shampoo|lotion|ubtan|neem|skincare|beauty/)) {
                category = 'Skincare & Beauty';
            }

            // Select image URL
            const categoryImages = CATEGORY_IMAGES[category] || CATEGORY_IMAGES['Others'];
            const imageIndex = (title.length + index) % categoryImages.length;
            const image = categoryImages[imageIndex];

            // Extract rating & review count or randomize deterministically
            const rating = parseFloat((4.0 + (title.length % 10) / 10).toFixed(1));
            const reviewCount = Math.floor((title.length * 13) % 250) + 18;

            // Specifications extraction
            const specifications = {
                Merchant: siteDomain,
                Features: snippet.substring(0, 100)
            };

            results.push({
                id: `scraped-${siteDomain}-${index}-${Date.now()}`,
                title,
                brand,
                category,
                image,
                price,
                originalPrice,
                rating,
                reviewCount,
                availability: 'In Stock',
                productUrl: link,
                specifications
            });

            index++;
        }

        return results;
    }
};
