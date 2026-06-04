import { BaseImporter } from './importerService.js';

export class KaggleImporter extends BaseImporter {
    constructor() {
        super('Kaggle');
    }

    normalizeRecord(raw) {
        // Safe price resolution (Kaggle datasets often contain pricing ranges or formats like "Rs. 1000")
        const cleanPrice = (priceStr) => {
            if (!priceStr) return 0;
            if (typeof priceStr === 'number') return priceStr;
            const digits = priceStr.replace(/[^0-9.]/g, '');
            return Number(digits) || 0;
        };

        const price = cleanPrice(raw.price || raw.selling_price || raw.discounted_price);
        const originalPrice = cleanPrice(raw.original_price || raw.retail_price || raw.mrp) || price;

        // Parse category tree e.g., ["Clothing >> Women's Clothing >> ..."]
        let category = 'Others';
        if (raw.product_category_tree) {
            try {
                const parsed = JSON.parse(raw.product_category_tree);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const parts = parsed[0].split('>>');
                    category = parts[0]?.trim() || category;
                }
            } catch (e) {
                if (typeof raw.product_category_tree === 'string') {
                    const parts = raw.product_category_tree.split('>>');
                    category = parts[0]?.trim() || category;
                }
            }
        } else if (raw.category) {
            category = raw.category;
        }

        // Parse images array
        let imageUrl = '';
        if (raw.image) {
            imageUrl = raw.image;
        } else if (raw.images) {
            try {
                const parsed = JSON.parse(raw.images);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    imageUrl = parsed[0];
                }
            } catch (e) {
                if (typeof raw.images === 'string') {
                    imageUrl = raw.images.split(',')[0]?.trim() || '';
                }
            }
        }

        return {
            external_id: raw.uniq_id || raw.external_id || raw.id || null,
            title: raw.product_name || raw.title || raw.name || '',
            brand: raw.brand || 'Generic',
            category,
            description: raw.description || '',
            image_url: imageUrl,
            product_url: raw.product_url || raw.url || '',
            price,
            original_price: originalPrice,
            rating: Number(raw.rating || raw.stars || raw.product_rating) || 4.0,
            review_count: Number(raw.review_count || raw.reviews_count || raw.total_reviews) || 0,
            features: [],
            reviews: []
        };
    }
}

export const kaggleImporter = new KaggleImporter();
